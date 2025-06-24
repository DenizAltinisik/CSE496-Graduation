# Web Uygulaması - Flask + React + MongoDB

Bu proje, Python Flask backend, React frontend ve MongoDB veritabanı kullanarak geliştirilmiş basit bir web uygulamasıdır.

## Özellikler

- Kullanıcı kayıt ve giriş sistemi
- JWT token tabanlı kimlik doğrulama
- MongoDB veritabanı entegrasyonu
- Modern React frontend
- Responsive tasarım

## Kurulum

### Gereksinimler

- Python 3.8+
- Node.js 14+
- MongoDB (yerel veya cloud)

### Backend Kurulumu

1. Backend klasörüne gidin:
```powershell
cd backend
```

2. Python sanal ortamı oluşturun:
```powershell
python -m venv venv
```

3. Sanal ortamı aktifleştirin:
```powershell
.\venv\Scripts\Activate.ps1
```

4. Gerekli paketleri yükleyin:
```powershell
pip install -r requirements.txt
```

5. MongoDB'nin çalıştığından emin olun ve uygulamayı başlatın:
```powershell
python app.py
```

### Frontend Kurulumu

1. Yeni bir terminal açın ve frontend klasörüne gidin:
```powershell
cd frontend
```

2. NPM paketlerini yükleyin:
```powershell
npm install
```

3. React uygulamasını başlatın:
```powershell
npm start
```


## API Endpoints

- `POST /api/register` - Kullanıcı kaydı
- `POST /api/login` - Kullanıcı girişi
- `GET /api/user` - Kullanıcı bilgileri (JWT gerekli)
- `GET /api/health` - Sistem durumu

## Teknolojiler

- **Backend**: Flask, Flask-JWT-Extended, PyMongo, Flask-CORS
- **Frontend**: React, React Router, Axios
- **Veritabanı**: MongoDB
- **Kimlik Doğrulama**: JWT Tokens
