type ReceiptType = "customer" | "trs" | "deposit" | "cancel" | "normal-cancel" | "rcp-cancel"

type ReceiptInfo = {
  hospitalName?: string
  bizNo?: string
  manager?: string
  address?: string
  tel?: string
  date?: string
  cardNo?: string
  cardName?: string
  approvalNo?: string
  supplyAmount?: string
  totalAmount?: string
  surtaxAmount?: string
  tax?: string
  cardAmount?: string
  installment?: string
  serialNumber?: string
  cancelNumber?: string
  cancelDate?: string
  tid?: string
  hospitalNo?: string
  rs13?: string
  rs14?: string
  items?: { name: string; amount: string; }[];
}

type PatientInfo = {
  name: string,
  passportNo: string,
  birth?: string,
  nationality: string
}

export const generateReceipt = async (
  printType: ReceiptType,
  info: ReceiptInfo,
  patient?: PatientInfo,
  paymentId?: string
) => {
  let printCommand = ""
  if (printType === "customer") {
    printCommand = generateCustomerReceipt(info, paymentId ?? "")
  } else if (printType === "deposit") {
    printCommand = generateDepositReceipt(info)
  } else if (printType === "trs") {
    printCommand = generateTRSReceipt(info, patient)
  } else if (printType === "normal-cancel") {
    printCommand = generateNormalCancelReceipt(info)
  } else if (printType === "rcp-cancel") {
    printCommand = generateRCPCancelReceipt(info)
  } else {
    printCommand = generateCancelReceipt(info)
  }

  return printCommand
}
const generateRCPCancelReceipt = (info: ReceiptInfo) => {
  let s = "EP"
  s += "\x1B\x40"
  s += "\x1B\x61\x01"
  s += "\x1B\x21\x30"
  s += "Easy Tax Refund\n"
  s += "\n"
  s += "\x1B\x40"
  s += "===============================\n"
  s += "\x1B\x61\x01"
  s += "\x1B\x21\x30"
  s += "도심환급 취소 영수증\n"
  s += "\x1B\x40"
  s += "\x1B\x61\x01"
  s += "\x1B\x21\x30"
  s += "Refund Cancellation Receipt\n"
  s += "\x1B\x40"
  s += "===============================\n"
  s += "\x1B\x61\x03"
  s += "Tel. +82-2-1600-1234  Fax. +82-2-6710-1472\n"
  s += "www.easytaxrefund.co.kr, etrs@kicc.co.kr\n"
  s += "한국정보통신(주)\n"
  s += "\n"
  s += "------------------------------\n"
  s += "의료기관/MEDICAL INSTITUTION\n"
  s += `의료기관명/Name of Institution: ${info.hospitalName}\n`
  s += `소재지/Address: ${info.address}\n`
  s += `전화번호/Phone Num: ${info.tel}\n`
  s += `사업자번호/Business Num: ${info.bizNo}\n`
  s += `의료기관등록번호/Registration Num: ${info.hospitalNo}\n`
  s += `대표자명/Name of Representative: ${info.manager}\n`
  s += `의료용역일/Date of sale: ${info.date}\n`
  s += `단말기등록번호/TID: ${info.tid}\n`
  s += "\n"
  s += "------------------------------\n"
  s += "\n"
  s += "Serial Number | Cancel Type | Cancel Amount\n"
  s += "------------------------------\n"

  if (info.items?.length) {
    for (const item of info.items) {
      const name = item.name.padEnd(14, ' ');
      const count = String(1).padEnd(10, ' ');
      const amount = item.amount.padStart(10, ' ');
      s += `${name}${count}${amount}\n`;
    }
  }

  s += "------------------------------\n"
  s += `total: ${info.items?.length} \n`
  s += " \n \n \n"
  s += "※ This receipt confirms the cancellation of the previous tax refund transaction. Please keep this receipt for your records."

  return s
}
const generateNormalCancelReceipt = (info: ReceiptInfo) => {
  let s = "EP"
  s += "\x1B\x40"
  s += "\x1B\x61\x01"
  s += "\x1B\x21\x30"
  s += "Easy Tax Refund\n"
  s += "\n"
  s += "\x1B\x40"
  s += "===============================\n"
  s += "\x1B\x61\x01"
  s += "\x1B\x21\x30"
  s += "취소 영수증\n"
  s += "\x1B\x40"
  s += "\x1B\x61\x01"
  s += "\x1B\x21\x30"
  s += "Cancel Tax Refund\n"
  s += "\x1B\x40"
  s += "===============================\n"
  s += "\x1B\x61\x03"
  s += "Tel. +82-2-1600-1234  Fax. +82-2-6710-1472\n"
  s += "www.easytaxrefund.co.kr, etrs@kicc.co.kr\n"
  s += "한국정보통신(주)\n"
  s += "\n"
  s += `결제 승인번호: ${info.serialNumber ?? ""}\n`
  s += "\n"
  s += "------------------------------\n"
  s += "의료기관/MEDICAL INSTITUTION\n"
  s += `의료기관명/Name of Institution: ${info.hospitalName}\n`
  s += `소재지/Address: ${info.address}\n`
  s += `전화번호/Phone Num: ${info.tel}\n`
  s += `사업자번호/Business Num: ${info.bizNo}\n`
  s += `의료기관등록번호/Registration Num: ${info.hospitalNo}\n`
  s += `대표자명/Name of Representative: ${info.manager}\n`
  s += `의료용역일/Date of sale: ${info.date}\n`
  s += `단말기등록번호/TID: ${info.tid}\n`
  s += "\n"
  s += "------------------------------\n"
  s += "카드 결제 취소\n"
  s += "--------------------------------\n"
  s += `카 드 번 호 : ${info.cardNo ?? ""}\n`
  s += `카 드 명   : ${info.cardName ?? ""}\n`
  s += `가맹점 번호 : ${info.rs13 ?? ""}\n`
  s += `매입 사 명  : ${info.rs14 ?? ""}\n`
  s += "\x1B\x64\x08"
  s += "\x1B\x61\x01"
  s += "\x1B\x21\x30"
  s += "취소 완료\n"
  s += "\x1B\x40"
  s += `취소 일자: ${info.cancelDate}\n`;
  s += `취소 승인번호: ${info.cancelNumber}\n`
  s += "\x1B\x64\x08"
  s += "\x1B\x69"
  return s
}
const generateCancelReceipt = (info: ReceiptInfo) => {
  let s = "EP"
  s += "\x1B\x40"
  s += "\x1B\x61\x01"
  s += "\x1B\x21\x30"
  s += "Easy Tax Refund\n"
  s += "\n"
  s += "\x1B\x40"
  s += "===============================\n"
  s += "\x1B\x61\x01"
  s += "\x1B\x21\x30"
  s += "취소 영수증\n"
  s += "\x1B\x40"
  s += "\x1B\x61\x01"
  s += "\x1B\x21\x30"
  s += "Cancel Tax Refund\n"
  s += "\x1B\x40"
  s += "===============================\n"
  s += "\x1B\x61\x03"
  s += "Tel. +82-2-1600-1234  Fax. +82-2-6710-1472\n"
  s += "www.easytaxrefund.co.kr, etrs@kicc.co.kr\n"
  s += "한국정보통신(주)\n"
  s += "\n"
  s += `구매일련번호: ${info.serialNumber ?? ""}\n`
  s += `Tax Free 승인번호: ${info.approvalNo ?? ""}\n`
  s += "\n"
  s += "------------------------------\n"
  s += "의료기관/MEDICAL INSTITUTION\n"
  s += `의료기관명/Name of Institution: ${info.hospitalName}\n`
  s += `소재지/Address: ${info.address}\n`
  s += `전화번호/Phone Num: ${info.tel}\n`
  s += `사업자번호/Business Num: ${info.bizNo}\n`
  s += `의료기관등록번호/Registration Num: ${info.hospitalNo}\n`
  s += `대표자명/Name of Representative: ${info.manager}\n`
  s += `의료용역일/Date of sale: ${info.date}\n`
  s += `단말기등록번호/TID: ${info.tid}\n`
  s += "\n"
  s += "------------------------------\n"
  s += "물품구매내역 Description of Good(s)\n"
  s += "\n"
  s += "종목          수량             금액\n"
  if (info.items?.length) {
    for (const item of info.items) {
      const name = item.name.padEnd(14, ' ');
      const count = String(1).padEnd(10, ' ');
      const amount = item.amount.padStart(10, ' ');
      s += `${name}${count}${amount}\n`;
    }
  }
  s += "------------------------------\n"
  s += "의료서비스내역 TYPES OF MEDICAL SERVICE\n"
  s += "(환급대상/V.A.T Refundable)\n"
  s += `합계/Total Amount: ${info.supplyAmount ?? ""}원\n`
  s += `부가세/V.A.T: ${info.surtaxAmount ?? ""}원\n`
  s += `개별소비세/I.C.T: 0원\n`
  s += `교육세/E.T: 0원\n`
  s += `환급액/NET REFUND: ${info.tax ?? ""}원\n`
    const expireDate = (() => {
    if (!info.date) return "";
    const [yy, mm, dd] = info.date.split("-");
    const dateObj = new Date(`${yy}-${mm}-${dd}`);
    dateObj.setDate(dateObj.getDate() + 90);
    return dateObj.toISOString().split("T")[0];
  })();
  s += `환급전표유효기간/Expire date: ${expireDate} \n`
  s += "\n\n\n"
  s += "------------------------------\n"
  s += "\x1B\x40"
  s += "\x1B\x61\x01"
  s += "\x1B\x21\x30"
  s += "TOURIST'S DETAILS\n"
  s += "\x1B\x40"
  s += "===============================\n"
  s += "\x1B\x61\x03"
  s += "Passport No.：\n"
  s += "Full Name：\n"
  s += "Nationality：\n"
  s += "E-mail：\n"
  s += "Credit Card No. (UnionPay,\n"
  s += "VISA, MasterCard, JCB)：\n"
  s += "Alipay-bound Mobile No. (Mainland China only)：\n"
  s += "\n"
  s += "\x1B\x40"
  s += "------------------------------\n"
  s += "In order to receive a tax refund, you must take your goods out of the country within 3 months of purchase.\n"
  s += "Please fill out the passport and refund-account\n"
  s += "information (credit card or Alipay account) in the Tourist's Details box and deposit it in the refund mailbox when you leave the country.\n"
  s += "The refund will be credited to your credit card within approximately one month after receipt of the mailbox.\n"
  s += "------------------------------\n"
  s += "서명/Signature       서명일/Date\n"
  s += "\x1B\x64\x08"
  s += "------------------------------\n"
  s += "\x1B\x61\x01"
  s += "\x1B\x21\x30"
  s += "취소 완료\n"
  s += "\x1B\x40"
  const cancelDateFormatted = info.cancelDate
  ? `${info.cancelDate.slice(0, 2)}-${info.cancelDate.slice(2, 4)}-${info.cancelDate.slice(4, 6)}`
  : "";
  s += `취소 일자: ${cancelDateFormatted}\n`;
  s += `취소 승인번호: ${info.cancelNumber}\n`
  s += "\x1B\x64\x08"
  s += "\x1B\x69"
  return s
}

const generateDepositReceipt = (info: ReceiptInfo) => {
  let s = "EP"
  s += "\x1B\x40"
  s += "\x1B\x61\x01"
  s += "\x1B\x21\x30"
  s += "\x1D\x42\xFF"
  s += "도심환급 영수증\n"
  s += "\x1B\x40\n\n"
  s += "\x1B\x61\x01"
  s += "\x1B\x21\x30"
  s += `[${info.hospitalName}]`
  s += "\x1B\x40\n\n"

  s += `사업자번호 : ${info.bizNo}\n`
  s += `주    소  : ${info.address}\n`
  s += `성    명 : ${info.manager}\n`
  s += `전    화 : ${info.tel}\n`
  s += `일    자 : ${info.date}\n`
  s += "--------------------------------\n"
  s += "신용 카드 승인\n"
  s += "--------------------------------\n"
  s += `카 드 번 호 : ${info.cardNo ?? ""}\n`
  s += `카 드 명   : ${info.cardName ?? ""}\n`
  s += `가맹점 번호 : \n`
  s += `매입 사 명  : \n`
  s += "--------------------------------\n"
  s += `현금  (환급액) / Total Refund Amount :\n`
  s += ` ${info.tax ?? ""}원\n`
  s += `예치결제 / Total Approved Amount(105 percent) :`
  s += ` ${info.cardAmount ?? ""}원\n`
  s += `구매일련번호 / Serial Number :\n`
  s += ` ${info.serialNumber ?? ""}\n`
  s += "--------------------------------\n"
  s += "* After getting downtown cash refund,\n"
  s += "please get electronic customs stamps\n"
  s += "within 20 days. If you do not, a fee\n"
  s += "(105 percent of refunded amount) will\n"
  s += "be charged to your credit card.\n\n"
  s += "--------------------------------\n"
  s += "\nCustomer Signature\n\n"
  s += "\n정성을 다하겠습니다.\n"
  s += "결제 취소시 반드시 영수증을 지참해 주시기 바랍니다.\n\n"
  s += "--------------------------------\n"
  s += "\x1B\x61\x01"
  s += "\n[TAX REFUND BARCODE]\n\n"
  s += "\x1B\x40"
  s += "\x1B\x61\x01"
  s += `\x1D\x68\x3C\x1D\x77\x03\x1D\x6B\x49\x16${info.serialNumber}\n\n`
  s += "\x1B\x61\x01"
  s += `${info.serialNumber ?? ""}\n`
  s += "\x1B\x64\x08"
  s += "\x1B\x69"
  return s
}

const generateCustomerReceipt = (info: ReceiptInfo, paymentId: string) => {
  const host =
    typeof window !== "undefined" && window.location.hostname
      ? window.location.hostname
      : "allfredo.kr";
  const link = `https://${host}/receipt?c=${paymentId}`;

  let s = "EP"
  s += "\x1B\x40"
  s += "\x1B\x61\x01"
  s += "\x1B\x21\x30"
  s += "\x1D\x42\xFF"
  s += "고객용 결제 영수증\n"
  s += "\x1B\x40\n\n"
  s += "\x1B\x61\x01"
  s += "\x1B\x21\x30"
  s += `[${info.hospitalName}]`
  s += "\x1B\x40\n\n"
  s += `사업자번호 : ${info.bizNo}\n`
  s += `주    소  : ${info.address}\n`
  s += `성    명 : ${info.manager}\n`
  s += `전    화 : ${info.tel}\n`
  s += `일    자 : ${info.date}\n`
  s += "--------------------------------\n"
  s += "신용 카드 승인\n"
  s += "--------------------------------\n"
  s += `카 드 번 호 : ${info.cardNo ?? ""}\n`
  s += `카 드 명   : ${info.cardName ?? ""}\n`
  s += `가맹점 번호 : ${info.rs13 ?? ""}\n`
  s += `매입 사 명  : ${info.rs14 ?? ""}\n`
  s += "--------------------------------\n"
  s += `공급가액 : ${info.supplyAmount ?? ""}원\n`
  s += `부가세액 : ${info.surtaxAmount ?? ""}원\n`
  s += `합   계 : ${info.totalAmount ?? ""}원\n`
  s += "--------------------------------\n"
  s += `카 드 결 제 : ${info.cardAmount ?? ""}원\n`
  s += `현금(환급액) : ${info.tax ?? ""}원\n`
  s += "--------------------------------\n"
  s += `할 부 개 월 : ${info.installment ?? ""}\n`
  s += `선불카드잔액 : 0원\n`
  s += `승 인 번 호 : ${info.approvalNo ?? ""}\n\n`
  s += "\x1B\x64\x04"
  s += "전자영수증 링크 View Receipt Online\n"
  s += `${link}\n`
  s += "\n"
  s += "위 주소를 브라우저에 입력하면 영수증을 다시 확인하실 수 있습니다.\n"
  s += "You can view this receipt again by entering the above link in your browser.\n"
  s += "\n정성을 다하겠습니다.\n"
  s += "결제 취소시 반드시 영수증을 지참해 주시기 바랍니다.\n"  
  s += "\x1B\x64\x04"
  s += "\x1B\x69"

  return s
}

const generateTRSReceipt = (info: ReceiptInfo, patient?: PatientInfo) => {
  let s = "EP"
  s += "\x1B\x40"
  s += "\x1B\x61\x01"
  s += "\x1B\x21\x30"
  s += "Easy Tax Refund\n"
  s += "\n"
  s += "\x1B\x40"
  s += "------------------------------\n"
  s += "\x1B\x61\x01"
  s += "\x1B\x21\x30"
  s += "의료용역환급\n"
  s += "\x1B\x40"
  s += "\x1B\x61\x01"
  s += "\x1B\x21\x30"
  s += "Medical Tax Refund\n"
  s += "\x1B\x40"
  s += "------------------------------\n"
  s += "\x1B\x61\x03"
  s += "Tel. +82-2-1600-1234  Fax. +82-2-6710-1472\n"
  s += "www.easytaxrefund.co.kr, etrs@kicc.co.kr\n"
  s += "한국정보통신(주)\n"
  s += "\n"
  s += `구매일련번호: ${info.serialNumber ?? ""}\n`
  s += `Tax Free 승인번호: ${info.approvalNo ?? ""}\n`
  s += "\n"
  s += "------------------------------\n"
  s += "의료기관/MEDICAL INSTITUTION\n"
  s += `의료기관명/Name of Institution: ${info.hospitalName}\n`
  s += `소재지/Address: ${info.address}\n`
  s += `전화번호/Phone Num: ${info.tel}\n`
  s += `사업자번호/Business Num: ${info.bizNo}\n`
  s += `의료기관등록번호/Registration Num: ${info.hospitalNo ?? ""}\n`
  s += `대표자명/Name of Representative: ${info.manager}\n`
  s += `의료용역일/Date of sale: ${info.date}\n`
  s += `단말기등록번호/TID: ${info.tid}\n`
  s += "\n"
  s += "------------------------------\n"
  s += "물품구매내역 Description of Good(s)\n"
  s += "\n"
  s += "종목          수량             금액\n"
  if (info.items?.length) {
    for (const item of info.items) {
      const name = item.name.padEnd(14, ' ');
      const count = String(1).padEnd(10, ' ');
      const amount = item.amount.padStart(10, ' ');
      s += `${name}${count}${amount}\n`;
    }
  }
  s += "------------------------------\n"
  s += "의료서비스내역 TYPES OF MEDICAL SERVICE\n"
  s += "(환급대상/V.A.T Refundable)\n"
  s += `합계/Total Amount: ${info.supplyAmount ?? ""}원\n`
  s += `부가세/V.A.T: ${info.surtaxAmount ?? ""}원\n`
  s += `개별소비세/I.C.T: 0원\n`
  s += `교육세/E.T: 0원\n`
  s += `환급액/NET REFUND: ${info.tax ?? ""}원\n`
    const expireDate = (() => {
    if (!info.date) return "";
    const [yy, mm, dd] = info.date.split("-");
    const dateObj = new Date(`20${yy}-${mm}-${dd}`);
    dateObj.setDate(dateObj.getDate() + 90);
    return dateObj.toISOString().split("T")[0];
  })();
  s += `환급전표유효기간/Expire date: ${expireDate} \n`
  s += "\n\n\n"
  s += "\x1B\x40"
  s += "\x1B\x61\x01"
  s += "\x1B\x21\x30"
  s += "\x1D\x42\xFF"
  s += "  환자정보/PATIENT    \n"
  s += "\n\n"
  s += "\x1B\x40"
  s += `여권번호/Passport Num : ${patient?.passportNo}\n`
  s += `성명/Full Name : ${patient?.name}\n`
  s += `생년월일/Date of Birth : ${patient?.birth ?? ""}\n`
  s += `국적/Nationality : ${patient?.nationality}\n`
  s += "\n"
  s += "------------------------------\n"
  s += "\x1B\x40"
  s += "\x1B\x61\x01"
  s += "\x1B\x21\x30"
  s += "TOURIST'S DETAILS\n"
  s += "\x1B\x40"
  s += "===============================\n"
  s += "\x1B\x61\x03"
  s += "Passport No.：\n"
  s += "Full Name：\n"
  s += "Nationality：\n"
  s += "E-mail：\n"
  s += "Credit Card No. (UnionPay,\n"
  s += "VISA, MasterCard, JCB)：\n"
  s += "Alipay-bound Mobile No. (Mainland China only)：\n"
  s += "\n"
  s += "\x1B\x40"
  s += "------------------------------\n"
  s += "In order to receive a tax refund, you must take your goods out of the country within 3 months of purchase.\n"
  s += "Please fill out the passport and refund-account\n"
  s += "information (credit card or Alipay account) in the Tourist's Details box and deposit it in the refund mailbox when you leave the country.\n"
  s += "The refund will be credited to your credit card within approximately one month after receipt of the mailbox.\n"
  s += "------------------------------\n"
  s += "서명/Signature       서명일/Date\n"
  s += "\x1B\x64\x08"
  s += "----------------------------------------\n"
  s += "세관의 반출확인란/ Customs Verification\n\n"
  s += "--------------------------------\n"
  s += "\x1B\x61\x01"
  s += "\n[TAX REFUND BARCODE]\n\n"
  s += "\x1B\x40"
  s += "\x1B\x61\x01"
  s += `\x1D\x68\x3C\x1D\x77\x03\x1D\x6B\x49\x16${info.serialNumber}\n\n`
  s += "\x1B\x61\x01"
  s += `${info.serialNumber ?? ""}\n`
  s += "\x1B\x64\x08"
  s += "\x1B\x69"
  return s
}