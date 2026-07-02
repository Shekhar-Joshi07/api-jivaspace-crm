export const sendSMS = async ({ to, message }) => {
  const { SMS_API_URL, SMS_API_KEY, SMS_SENDER_ID } = process.env;

  if (!SMS_API_URL || !SMS_API_KEY) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMS service is not configured');
    }

    return {
      messageId: `dev-sms-${Date.now()}`,
      simulated: true,
      to,
      message
    };
  }

  const response = await fetch(SMS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SMS_API_KEY}`
    },
    body: JSON.stringify({ to, message, senderId: SMS_SENDER_ID })
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`SMS provider rejected the request: ${response.status} ${responseText}`);
  }

  const data = await response.json();
  return { messageId: data.messageId || data.id, providerResponse: data };
};
