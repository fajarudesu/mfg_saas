.PHONY: start start-frontend start-backend install clean

# Start both frontend and backend in parallel
start:
	@echo "Starting Manufacturing List Generator..."
	@make -j2 start-backend start-frontend

start-backend:
	@echo "Starting FastAPI Backend on port 8000..."
	cd backend && uvicorn main:app --port 8000 --reload

start-frontend:
	@echo "Starting React Frontend on port 3000..."
	cd frontend && npm run dev

install:
	@echo "Installing Backend dependencies..."
	cd backend && pip3 install -r requirements.txt
	@echo "Installing Frontend dependencies..."
	cd frontend && npm install

clean:
	@echo "Cleaning up generated files and caches..."
	rm -rf backend/__pycache__
	rm -rf frontend/node_modules
	rm -rf frontend/dist
	@echo "Clean complete."
