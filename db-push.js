// This script runs `npm run db:push` to create the database tables
const { execSync } = require('child_process');

console.log('Running database migration...');
try {
  const result = execSync('npm run db:push', { encoding: 'utf-8' });
  console.log(result);
  console.log('Database migration completed successfully');
} catch (error) {
  console.error('Error during database migration:');
  console.error(error.message);
  process.exit(1);
}