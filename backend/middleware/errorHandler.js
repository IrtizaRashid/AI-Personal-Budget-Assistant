// Central error-handling middleware.
// Express recognises this as an error handler because it has 4 arguments.
// Registering it last (after routes) lets every route funnel errors here
// instead of duplicating try/catch response logic.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  console.error('❌ Error:', err.message);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
};

// 404 handler for unknown routes.
export const notFound = (req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
};
