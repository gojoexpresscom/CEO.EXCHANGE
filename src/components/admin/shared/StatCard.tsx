interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  color?: string;
}

export default function StatCard({ label, value, sub, icon, color = "#f5b51b" }: StatCardProps) {
  return (
    <div
      style={{
        background: "linear-gradient(145deg, #121212 0%, #0a0a0a 100%)",
        border: "1px solid #1f1f1f",
        borderRadius: 14,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minWidth: 0,
        flex: 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#888", fontSize: 13, fontWeight: 500 }}>{label}</span>
        {icon && (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `${color}18`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color,
            }}
          >
            {icon}
          </div>
        )}
      </div>
      <div style={{ color: "#fff", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}>
        {value}
      </div>
      {sub && <div style={{ color: "#666", fontSize: 12 }}>{sub}</div>}
    </div>
  );
}
