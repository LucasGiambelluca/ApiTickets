#!/bin/bash

# Ticketera Deployment Script
# Usage: ./scripts/deploy.sh [environment]

set -e

ENVIRONMENT=${1:-production}
PROJECT_NAME="ticketera"

echo "🚀 Deploying Ticketera to $ENVIRONMENT environment"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed"
    exit 1
fi

print_status "Docker and Docker Compose are available"

# Check if .env file exists
if [ ! -f ".env" ]; then
    print_error ".env file not found"
    print_warning "Please create .env file with required configuration"
    exit 1
fi

print_status ".env file found"

# Validate required environment variables
required_vars=("DB_HOST" "DB_USER" "DB_PASSWORD" "DB_NAME" "REDIS_HOST")
missing_vars=()

for var in "${required_vars[@]}"; do
    if ! grep -q "^$var=" .env; then
        missing_vars+=("$var")
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    print_error "Missing required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    exit 1
fi

print_status "Environment variables validated"

# Build and start services
print_status "Building Docker images..."
docker-compose build --no-cache

print_status "Starting services..."
docker-compose up -d

# Wait for services to be ready
print_status "Waiting for services to be ready..."
sleep 10

# Check if MySQL is ready
print_status "Checking MySQL connection..."
max_attempts=30
attempt=1

while [ $attempt -le $max_attempts ]; do
    if docker-compose exec -T mysql mysqladmin ping -h localhost --silent; then
        print_status "MySQL is ready"
        break
    fi
    
    if [ $attempt -eq $max_attempts ]; then
        print_error "MySQL failed to start after $max_attempts attempts"
        docker-compose logs mysql
        exit 1
    fi
    
    print_warning "Waiting for MySQL... (attempt $attempt/$max_attempts)"
    sleep 2
    ((attempt++))
done

# Check if Redis is ready
print_status "Checking Redis connection..."
if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
    print_status "Redis is ready"
else
    print_error "Redis is not responding"
    docker-compose logs redis
    exit 1
fi

# Run database migrations
print_status "Running database setup..."
docker-compose exec -T app npm run db:schema
docker-compose exec -T app npm run db:upgrade

# Load seed data if in development
if [ "$ENVIRONMENT" = "development" ]; then
    print_status "Loading seed data..."
    docker-compose exec -T app npm run db:seed
fi

# Health check
print_status "Performing health check..."
sleep 5

if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    print_status "Application is healthy"
else
    print_error "Health check failed"
    docker-compose logs app
    exit 1
fi

# Show running services
print_status "Deployment completed successfully!"
echo ""
echo "📊 Services Status:"
docker-compose ps

echo ""
echo "🌐 Application URLs:"
echo "  - API: http://localhost:3000"
echo "  - Health Check: http://localhost:3000/health"
echo "  - MySQL: localhost:3306"
echo "  - Redis: localhost:6379"

echo ""
echo "📋 Useful Commands:"
echo "  - View logs: docker-compose logs -f"
echo "  - Stop services: docker-compose down"
echo "  - Restart: docker-compose restart"
echo "  - Shell access: docker-compose exec app sh"

echo ""
print_status "Ticketera is now running in $ENVIRONMENT mode! 🎫"
