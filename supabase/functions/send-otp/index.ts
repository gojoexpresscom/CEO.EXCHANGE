import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function generateOTP(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);

  let code = "";

  for (let i = 0; i < 6; i++) {
    code += (bytes[i] % 10).toString();
  }

  return code;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    const brevoSenderEmail = Deno.env.get("BREVO_SENDER_EMAIL");
    const brevoSenderName =
      Deno.env.get("BREVO_SENDER_NAME") || "CEO Exchange";

    const authHeader =
      req.headers.get("Authorization") || "";

    const jwt = authHeader.replace("Bearer ", "");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const {
      data: userData,
      error: userErr,
    } = await userClient.auth.getUser(jwt);

    if (userErr || !userData?.user?.email) {
      return json(
        {
          error: "Not authenticated",
        },
        401,
      );
    }

    const userId = userData.user.id;
    const email = userData.user.email;

    const body = await req.json().catch(() => ({}));

    const purpose = String(
      body?.purpose || "login",
    ).slice(0, 50);

    if (
      purpose === "withdrawal" &&
      (!brevoApiKey || !brevoSenderEmail)
    ) {
      return json(
        {
          error:
            "Withdrawal email OTP is not configured. Add BREVO_API_KEY and BREVO_SENDER_EMAIL to the Supabase Edge Function secrets.",
          email_delivered: false,
        },
        503,
      );
    }

    const admin = createClient(
      supabaseUrl,
      serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    );

    const cutoff = new Date(
      Date.now() - 60 * 1000,
    ).toISOString();

    const { data: recent } = await admin
      .from("otp_codes")
      .select("id")
      .eq("email", email)
      .eq("purpose", purpose)
      .gte("created_at", cutoff)
      .limit(1);

    if (recent && recent.length > 0) {
      return json(
        {
          error:
            "Please wait before requesting another code.",
        },
        429,
      );
    }

    const code = generateOTP();

    const expiresAt = new Date(
      Date.now() + 10 * 60 * 1000,
    );

    await admin
      .from("otp_codes")
      .update({ used: true })
      .eq("email", email)
      .eq("purpose", purpose)
      .eq("used", false);

    const { error: insertError } = await admin
      .from("otp_codes")
      .insert({
        email,
        user_id: userId,
        code,
        purpose,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      return json(
        {
          error: "Failed to generate code",
        },
        500,
      );
    }

    if (!brevoApiKey || !brevoSenderEmail) {
      return json({
        success: true,
        email_delivered: false,
        message:
          "Code generated, but no transactional email provider is configured.",
      });
    }

    const brevoResponse = await fetch(
      "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": brevoApiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            email: brevoSenderEmail,
            name: brevoSenderName,
          },
          to: [{ email }],
          subject:
            "CEO Exchange withdrawal verification code",
          textContent:
            `Your CEO Exchange withdrawal verification code is ${code}. It expires in 10 minutes. If you did not request a withdrawal, do not use this code and contact support.`,
          htmlContent:
            `<p>Your CEO Exchange withdrawal verification code is <strong>${code}</strong>.</p><p>This code expires in 10 minutes.</p><p>If you did not request a withdrawal, do not use this code and contact support.</p>`,
        }),
      },
    );

    if (!brevoResponse.ok) {
      await admin
        .from("otp_codes")
        .update({ used: true })
        .eq("email", email)
        .eq("purpose", purpose)
        .eq("code", code)
        .eq("used", false);

      const providerBody =
        await brevoResponse.text().catch(() => "");

      return json(
        {
          error:
            `Transactional email delivery failed: ${
              providerBody ||
              brevoResponse.statusText
            }`,
          email_delivered: false,
        },
        502,
      );
    }

    return json({
      success: true,
      email_delivered: true,
    });
  } catch (err) {
    return json(
      {
        error: String(err),
        email_delivered: false,
      },
      500,
    );
  }
});
