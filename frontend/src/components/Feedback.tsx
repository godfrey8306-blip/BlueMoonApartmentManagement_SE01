export function Feedback({ error, success }: { error?: string; success?: string }) {
  return <>{error && <div className="alert alert-error" role="alert">{error}</div>}{success && <div className="alert alert-success" role="status">{success}</div>}</>
}
