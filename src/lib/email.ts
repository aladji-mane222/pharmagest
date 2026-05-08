import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

export async function envoyerEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
}) {
  try {
    await transporter.sendMail({
      from: `PharmaGest <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    })
    console.log('Email envoye a:', to)
  } catch (error) {
    console.error('Erreur envoi email:', error)
  }
}

export function templateAlertStock(medicaments: { nom: string; stock: number; minimum: number }[]) {
  return `
    <h2 style="color: #dc2626;">Alerte Stock Bas — PharmaGest</h2>
    <p>Les medicaments suivants ont un stock inferieur au minimum :</p>
    <table style="border-collapse: collapse; width: 100%;">
      <tr style="background: #f3f4f6;">
        <th style="padding: 8px; border: 1px solid #e5e7eb;">Medicament</th>
        <th style="padding: 8px; border: 1px solid #e5e7eb;">Stock actuel</th>
        <th style="padding: 8px; border: 1px solid #e5e7eb;">Stock minimum</th>
      </tr>
      ${medicaments.map((m) => `
        <tr>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${m.nom}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb; color: #dc2626;">${m.stock}</td>
          <td style="padding: 8px; border: 1px solid #e5e7eb;">${m.minimum}</td>
        </tr>
      `).join('')}
    </table>
    <p style="color: #6b7280; font-size: 12px;">PharmaGest — Pilotee par vous, ou que vous soyez</p>
  `
}
