export default function ErrorMessage({ message }) {
  const text =
    message ||
    "Couldn't reach the API. Make sure the backend is running on localhost:8001 (cd backend && npm run dev)."
  return (
    <div className="error-box">
      <strong>Something went wrong</strong>
      <p>{text}</p>
    </div>
  )
}
