# PowerShell script to run both backend and frontend
Write-Host "🚀 Starting Flask + React Web App with Chatbot..." -ForegroundColor Green

# Check if MongoDB is running
Write-Host "📦 Checking MongoDB..." -ForegroundColor Yellow
$mongoProcess = Get-Process mongod -ErrorAction SilentlyContinue
if (-not $mongoProcess) {
    Write-Host "⚠️  MongoDB is not running. Please start MongoDB first." -ForegroundColor Red
    Write-Host "   You can start it with: mongod --dbpath C:\data\db" -ForegroundColor Yellow
    exit 1
}

# Start backend in a new PowerShell window
Write-Host "🐍 Starting Flask backend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Jamai\Desktop\CSE 496 Bitirme\proje 2\backend'; .\venv\Scripts\Activate.ps1; python app.py"

# Wait a moment for backend to start
Start-Sleep -Seconds 3

# Start frontend in a new PowerShell window
Write-Host "⚛️  Starting React frontend..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd 'c:\Users\Jamai\Desktop\CSE 496 Bitirme\proje 2\frontend'; npm start"

Write-Host "✅ Both services are starting..." -ForegroundColor Green
Write-Host "📱 Frontend will be available at: http://localhost:3000" -ForegroundColor Blue
Write-Host "🔧 Backend will be available at: http://localhost:5000" -ForegroundColor Blue
Write-Host ""
Write-Host "🤖 Don't forget to add your OpenAI API key to backend\.env file!" -ForegroundColor Yellow
Write-Host "   OPENAI_API_KEY=your-actual-api-key-here" -ForegroundColor Yellow
