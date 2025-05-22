const jwt = require('jsonwebtoken');

// Secret key for signing JWT tokens
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';  // Fetch from environment variables for security

// Function to generate JWT token
function generateToken(user) {
  return jwt.sign({ 
    username: user.username, 
    role_ID: user.role_ID  // Include role_ID in the JWT payload
  }, JWT_SECRET, { expiresIn: '1h' });
}

// Middleware to authenticate user based on JWT
function authenticateUser(req, res, next) {
  const token = req.header('Authorization')?.replace('Bearer ', '');  // Extract token from the 'Authorization' header

  if (!token) {
    return res.status(401).json({ message: 'Authentication failed: No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);  // Verify the token
    req.user = decoded;  // Attach user information to the request
    next();  // Move to the next middleware or route
  } catch (err) {
    // Improved error handling with specific messages for debugging
    console.error('JWT verification failed:', err.message);
    return res.status(401).json({ message: 'Authentication failed: Invalid or expired token' });
  }
}

// Middleware to check user's role
function checkRole(allowedRoles) {
  return (req, res, next) => {
    const userRole = req.user?.role_ID;  // Get the user's role from the decoded token
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ message: 'Permission denied: Insufficient privileges' });
    }
    next();  // User has the right role, proceed to the next middleware or route
  };
}

module.exports = { generateToken, authenticateUser, checkRole };
