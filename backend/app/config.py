from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "KTX 5S AI"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    SECRET_KEY: str = ""

    # SQL Server
    DB_DRIVER: str = "ODBC Driver 17 for SQL Server"
    DB_SERVER: str = "localhost"
    DB_NAME: str = "ktx5s_db"
    DB_AUTH_MODE: str = "windows"
    DB_USERNAME: str = ""
    DB_PASSWORD: str = ""

    # Gemini AI
    GEMINI_API_KEY: str = ""

    # Cloudinary
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    @property
    def DATABASE_URL(self) -> str:
        driver = self.DB_DRIVER.replace(" ", "+")
        # Tự động dùng Windows Authentication nếu DB_AUTH_MODE=windows hoặc không có mật khẩu
        if self.DB_AUTH_MODE.lower() == "windows" or not self.DB_PASSWORD:
            return (
                f"mssql+pyodbc://@{self.DB_SERVER}/{self.DB_NAME}"
                f"?driver={driver}&trusted_connection=yes&TrustServerCertificate=yes"
            )
        # Dùng tài khoản sa / SQL Server Authentication
        return (
            f"mssql+pyodbc://{self.DB_USERNAME}:{self.DB_PASSWORD}"
            f"@{self.DB_SERVER}/{self.DB_NAME}"
            f"?driver={driver}&TrustServerCertificate=yes"
        )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()