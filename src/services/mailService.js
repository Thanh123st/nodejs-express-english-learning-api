const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

// Gửi mail cho customer
async function sendMailToCustomer(contact) {
  try {
    await resend.emails.send({
      from: "Hệ thống <no-reply@element-trac-group.id.vn>", // nhớ đổi domain đã verify
      to: contact.email,
      subject: "Cảm ơn bạn đã liên hệ",
      html: `
        <h3>Xin chào ${contact.fullName},</h3>
        <p>Cảm ơn bạn đã liên hệ với chúng tôi. Nội dung bạn gửi:</p>
        <blockquote>${contact.content || "(không có nội dung)"}</blockquote>
        <p>Chúng tôi sẽ phản hồi sớm nhất có thể.</p>
      `,
    });
    console.log("✅ Email sent to customer:", contact.email);
  } catch (err) {
    console.error("❌ Error sending mail to customer:", err);
  }
}

// Gửi mail cho admin
async function sendMailToAdmin(contact) {
  try {
    await resend.emails.send({
      from: "Your App <onboarding@resend.dev>",
      to: "hoctrohoangthanh@gmail.com", // email quản trị
      subject: "Khách hàng mới liên hệ",
      html: `
        <h3>Thông tin khách hàng:</h3>
        <ul>
          <li>Họ tên: ${contact.fullName}</li>
          <li>Email: ${contact.email}</li>
          <li>SĐT: ${contact.phoneNumber}</li>
        </ul>
        <p>Nội dung: ${contact.content || "(không có nội dung)"}</p>
      `,
    });
    console.log("✅ Email sent to admin");
  } catch (err) {
    console.error("❌ Error sending mail to admin:", err);
  }
}

module.exports = { sendMailToCustomer, sendMailToAdmin };
