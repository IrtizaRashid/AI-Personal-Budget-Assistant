// Controllers hold the business logic for a route.
// Keeping handlers here (instead of inline in routes) makes the
// codebase modular and easy to test/extend.

// GET /api/health
export const getHealth = async (req, res) => {
  res.status(200).json({ status: 'Server Running' });
};
