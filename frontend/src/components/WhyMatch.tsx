export function WhyMatch({ reason, model }: { reason?: string; model?: string }) {
  if (!reason) return null;
  return (
    <p className="mt-3 rounded-2xl bg-gold-soft/50 px-3 py-2 text-sm leading-6 text-navy">
      <span className="mb-0.5 block text-[11px] tracking-[0.16em] text-gold uppercase">
        Why you match{model === "muse-spark-1.3" ? " · Muse Spark" : ""}
      </span>
      {reason}
    </p>
  );
}
