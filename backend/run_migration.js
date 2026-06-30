// Helper script to run the auth migration
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const connection = await mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

console.log('Connected to MySQL database');

try {
  // Add email column
  await connection.execute(`
    ALTER TABLE users 
    ADD COLUMN email VARCHAR(255) UNIQUE NOT NULL AFTER name
  `);
  console.log('✅ Added email column');
} catch (err) {
  if (err.code === 'ER_DUP_FIELDNAME') {
    console.log('ℹ️  email column already exists');
  } else {
    console.error('❌ Error adding email column:', err.message);
  }
}

try {
  // Add password_hash column
  await connection.execute(`
    ALTER TABLE users 
    ADD COLUMN password_hash VARCHAR(255) NOT NULL AFTER email
  `);
  console.log('✅ Added password_hash column');
} catch (err) {
  if (err.code === 'ER_DUP_FIELDNAME') {
    console.log('ℹ️  password_hash column already exists');
  } else {
    console.error('❌ Error adding password_hash column:', err.message);
  }
}

try {
  // Add updated_at column
  await connection.execute(`
    ALTER TABLE users 
    ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at
  `);
  console.log('✅ Added updated_at column');
} catch (err) {
  if (err.code === 'ER_DUP_FIELDNAME') {
    console.log('ℹ️  updated_at column already exists');
  } else {
    console.error('❌ Error adding updated_at column:', err.message);
  }
}

try {
  // Create index on email
  await connection.execute(`
    CREATE INDEX idx_users_email ON users(email)
  `);
  console.log('✅ Created index on email');
} catch (err) {
  if (err.code === 'ER_DUP_KEYNAME') {
    console.log('ℹ️  email index already exists');
  } else {
    console.error('❌ Error creating email index:', err.message);
  }
}

await connection.end();
console.log('Migration completed!');
