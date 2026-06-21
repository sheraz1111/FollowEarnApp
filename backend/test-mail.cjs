const nodemailer = require("nodemailer");

async function testEmail() {
    let transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: "sherazwalled218@gmail.com",
            pass: "gsherazg222"
        }
    });

    try {
        let info = await transporter.sendMail({
            from: '"Test" <sherazwalled218@gmail.com>',
            to: "sherazwalled218@gmail.com",
            subject: "Test Email",
            text: "Testing 123",
        });
        console.log("Success:", info.messageId);
    } catch (error) {
        console.error("Error:", error);
    }
}

testEmail();
