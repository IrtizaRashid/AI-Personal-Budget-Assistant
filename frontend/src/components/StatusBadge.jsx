// A small reusable presentational component.
// Demonstrates the components/ folder convention; reused by Home.jsx
// to render the backend status with colour based on state.
export default function StatusBadge({ status }) {
  const styles = {
    idle: 'bg-gray-100 text-gray-600',
    loading: 'bg-yellow-100 text-yellow-700',
    success: 'bg-green-100 text-green-700',
    error: 'bg-red-100 text-red-700',
  };

  const labels = {
    idle: 'Not checked yet',
    loading: 'Checking…',
    success: 'Server Running',
    error: 'Server Unreachable',
  };

  return (
    <span
      className={`inline-block rounded-full px-4 py-1 text-sm font-medium ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
