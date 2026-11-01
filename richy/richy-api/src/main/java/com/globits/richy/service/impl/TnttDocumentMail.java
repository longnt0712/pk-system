package com.globits.richy.service.impl;

import java.nio.charset.StandardCharsets;
import java.util.*;
import javax.mail.*;
import javax.mail.internet.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class TnttDocumentMail {
    @Value("${tntt.documents.email.enabled:false}")
    private boolean enabled;

    @Value("${tntt.documents.email.host:}")
    private String host;

    @Value("${tntt.documents.email.port:587}")
    private int port;

    @Value("${tntt.documents.email.username:}")
    private String username;

    @Value("${tntt.documents.email.password:}")
    private String password;

    @Value("${tntt.documents.email.from:}")
    private String from;

    @Value("${tntt.documents.public-url:https://tnttphungkhoang.com}")
    private String publicUrl;

    public static boolean validEmail(String s) {
        return s != null
                && s.length() <= 250
                && s.matches("[^\\s@<>\\r\\n]+@[^\\s@<>\\r\\n]+\\.[^\\s@<>\\r\\n]+");
    }

    public boolean configured() {
        return enabled
                && host != null
                && !host.trim().isEmpty()
                && port > 0
                && port <= 65535
                && validEmail(from);
    }

    public void send(String recipient, String title, String summary, String messageKey) {
        if (!configured() || !validEmail(recipient))
            throw new IllegalArgumentException(
                    "Chưa cấu hình email gửi hoặc địa chỉ nhận không hợp lệ.");
        try {
            Properties p = new Properties();
            p.setProperty("mail.smtp.host", host);
            p.setProperty("mail.smtp.port", String.valueOf(port));
            p.setProperty("mail.smtp.starttls.enable", "true");
            p.setProperty("mail.smtp.starttls.required", "true");
            p.setProperty("mail.smtp.ssl.checkserveridentity", "true");
            p.setProperty("mail.smtp.connectiontimeout", "8000");
            p.setProperty("mail.smtp.timeout", "8000");
            p.setProperty("mail.smtp.writetimeout", "8000");
            boolean auth = username != null && !username.isEmpty();
            p.setProperty("mail.smtp.auth", String.valueOf(auth));
            Session session =
                    Session.getInstance(
                            p,
                            auth
                                    ? new Authenticator() {
                                        protected PasswordAuthentication
                                                getPasswordAuthentication() {
                                            return new PasswordAuthentication(username, password);
                                        }
                                    }
                                    : null);
            MimeMessage msg = new MimeMessage(session);
            msg.setFrom(new InternetAddress(from));
            msg.setRecipient(Message.RecipientType.TO, new InternetAddress(recipient));
            msg.setSubject(title.replaceAll("[\\r\\n]", " "), "UTF-8");
            msg.setSentDate(new Date());
            String base = publicUrl.replaceAll("/+$", "");
            if (!base.matches("https://(?:www\\.)?tnttphungkhoang\\.com"))
                throw new IllegalArgumentException(
                        "Địa chỉ tài liệu phải là domain TNTT qua HTTPS.");
            String link =
                    messageKey.startsWith("notice-")
                            ? base + "/tai-lieu?notice=" + messageKey.substring(7)
                            : base + "/tai-lieu";
            msg.setText(
                    "THIẾU NHI THÁNH THỂ PHÙNG KHOANG\n\n"
                            + title
                            + "\n\n"
                            + (summary == null ? "" : summary)
                            + "\n\nXem tài liệu (cần đăng nhập đúng tài khoản):\n"
                            + link
                            + "\n\nBạn nhận email vì thuộc nhóm nhận thông báo TNTT. Trạng thái Đã đọc được ghi nhận khi bạn xác nhận trên website.",
                    StandardCharsets.UTF_8.name());
            Transport.send(msg);
        } catch (MessagingException e) {
            throw new IllegalStateException(
                    "Chưa xác nhận gửi được email. Kiểm tra hộp thư gửi trước khi thử lại.");
        }
    }
}
