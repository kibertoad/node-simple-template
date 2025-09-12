process.loadEnvFile('./.env')
process.env.DATABASE_URL = 'postgresql://testuser:testpass@localhost:25432/test_db_tests'
