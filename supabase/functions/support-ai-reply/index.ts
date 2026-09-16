      if (providerError.category === "RATE_LIMITED") {
        return json(
          {
            error:
              'AI support has hit its API quota limit for now. Please try again shortly, or type "talk to a human agent" to reach a person.',
          },
          429,
        );
      }
      return json({ error: "Support AI is temporarily unavailable. Please try again shortly." }, 503);
    }

    const replyText =
      result.reply || 'Sorry, I couldn\'t come up with an answer for that — you can type "talk to a human agent" to reach a person.';

    const { error: insertErr } = await admin.from("ticket_messages").insert({
      ticket_id: ticketId,
      sender_id: null,
      sender_type: "ai",
      message: replyText,
    });
    if (insertErr) {
      console.error(`support-ai-reply: insert failed for ticket ${ticketId}:`, insertErr.message);
      return json({ error: insertErr.message }, 500);
    }

    if (result.providerName !== "gemini") {
      console.error(
        `support-ai-reply: served by fallback provider=${result.providerName} model=${result.model} for ticket ${ticketId}`,
      );
    }

    return json({ reply: replyText, handoff: false });
  } catch (err) {
    console.error(`support-ai-reply: unhandled error for ticket ${ticketIdForLog ?? "unknown"}:`, err);
    return json({ error: String(err) }, 500);
  }
});

