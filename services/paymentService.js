export const processPayment = async (payment) => {
  console.log('[SANDBOX MODE] Processing payment in mock sandbox environment...');

  const randomSuffix = Math.floor(100000 + Math.random() * 900000).toString();
  const invoiceNo = `INV-${randomSuffix}`;

  payment.status = 'paid';
  payment.paidAt = new Date();
  payment.invoiceNo = invoiceNo;

  if (typeof payment.save === 'function') {
    await payment.save();
  }

  console.log(`[SANDBOX MODE] Payment successfully processed. Invoice: ${invoiceNo}`);
  return payment;
};

export default {
  processPayment
};
