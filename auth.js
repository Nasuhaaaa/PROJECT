const jwt = require('jsonwebtoken');

// Secret key for signing JWT tokens
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

// Function to generate JWT token
function generateToken(user) {
  return jwt.sign({ 
    username: user.username, 
    role_ID: user.role_ID,
    staff_ID: user.staff_ID,
    department_ID: user.department_ID 
  }, JWT_SECRET, { expiresIn: '1h' });
}

// Middleware to authenticate user based on JWT
function authenticateUser(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Authentication failed: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('JWT verification failed:', err.message);
    return res.status(401).json({ message: 'Authentication failed: Invalid or expired token' });
  }
}

// Middleware to check user's role
function checkRole(allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user?.role_ID;
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: 'Permission denied: Insufficient privileges' });
    }
    next();
  };
}

module.exports = { generateToken, authenticateUser, checkRole };
