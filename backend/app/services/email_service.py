import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from app.config import Settings

settings = Settings()


def send_otp_email(recipient_email: str, recipient_name: str, otp_code: str) -> tuple[bool, str]:
    """
    Gửi email chứa mã OTP thực tế qua giao thức SMTP (Gmail hoặc Mail Server trường).
    Trả về (success, message).
    """
    smtp_email = settings.SMTP_EMAIL.strip()
    smtp_password = settings.SMTP_PASSWORD.strip()
    smtp_server = settings.SMTP_SERVER.strip() or "smtp.gmail.com"
    smtp_port = settings.SMTP_PORT or 587

    # Nếu người dùng chưa cấu hình thông tin SMTP trong file .env
    if not smtp_email or not smtp_password:
        print(f"⚠️ [SMTP Warning] Chưa điền SMTP_EMAIL / SMTP_PASSWORD trong .env. Mã OTP thực: {otp_code} gửi tới {recipient_email}")
        return False, "Hệ thống máy chủ chưa cấu hình SMTP_EMAIL và SMTP_PASSWORD trong file .env."

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"[{otp_code}] Mã xác thực OTP khôi phục mật khẩu KTX 5S AI"
        msg["From"] = f"{settings.SMTP_SENDER_NAME} <{smtp_email}>"
        msg["To"] = recipient_email

        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f9; margin: 0; padding: 20px; }}
            .container {{ max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08); border: 1px solid #e1e8ed; }}
            .header {{ background: linear-gradient(135deg, #222d32 0%, #2c3b41 50%, #3c8dbc 100%); color: #ffffff; padding: 28px 24px; text-align: center; }}
            .header h1 {{ margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }}
            .header p {{ margin: 6px 0 0; font-size: 13px; color: #b8c7ce; }}
            .body {{ padding: 30px 24px; color: #333333; line-height: 1.6; font-size: 14px; }}
            .otp-box {{ background-color: #f0f7fd; border: 2px dashed #3c8dbc; border-radius: 8px; text-align: center; padding: 18px; margin: 24px 0; }}
            .otp-code {{ font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #d81b60; font-family: monospace; }}
            .warning {{ background-color: #fff9e6; border-left: 4px solid #f39c12; padding: 12px 14px; font-size: 12px; color: #8a6d3b; margin-top: 20px; }}
            .footer {{ background-color: #fafbfc; border-top: 1px solid #e1e8ed; padding: 18px 24px; text-align: center; font-size: 12px; color: #7f8c8d; }}
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>HỆ THỐNG KTX 5S AI</h1>
              <p>Trung tâm Quản lý Ký túc xá và Khu đô thị ĐHQG-HCM</p>
            </div>
            <div class="body">
              <p>Xin chào <b>{recipient_name}</b>,</p>
              <p>Bạn (hoặc ai đó) vừa yêu cầu cấp lại mật khẩu đăng nhập trên Hệ thống đánh giá vệ sinh phòng ở KTX 5S AI.</p>
              <p>Dưới đây là mã xác thực OTP của bạn:</p>
              
              <div class="otp-box">
                <div style="font-size: 12px; color: #605ca8; font-weight: 600; margin-bottom: 6px;">MÃ XÁC THỰC OTP (HIỆU LỰC 5 PHÚT)</div>
                <div class="otp-code">{otp_code}</div>
              </div>

              <p>Vui lòng nhập mã này vào trang khôi phục mật khẩu để hoàn tất thiết lập mật khẩu mới.</p>

              <div class="warning">
                <b>Lưu ý bảo mật:</b> Tuyệt đối không chia sẻ mã này cho bất kỳ ai khác, kể cả cán bộ quản lý KTX. Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email.
              </div>
            </div>
            <div class="footer">
              <p>© 2026 Trung tâm Quản lý Ký túc xá — Hệ thống Đánh giá 5S tự động bằng AI</p>
            </div>
          </div>
        </body>
        </html>
        """

        part_html = MIMEText(html_content, "html", "utf-8")
        msg.attach(part_html)

        # Kết nối tới SMTP server
        if smtp_port == 465:
            server = smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=10)
        else:
            server = smtplib.SMTP(smtp_server, smtp_port, timeout=10)
            server.starttls()

        server.login(smtp_email, smtp_password)
        server.sendmail(smtp_email, [recipient_email], msg.as_string())
        server.quit()

        print(f"✅ [SMTP Success] Đã gửi mã OTP thực tế tới {recipient_email}")
        return True, "Đã gửi email thành công."
    except Exception as e:
        print(f"❌ [SMTP Error] Gửi email thất bại: {e}")
        return False, f"Không thể gửi email: {str(e)}"
