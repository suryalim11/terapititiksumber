import { Request, Response } from "express";

/**
 * Endpoint pengujian penanganan tanggal
 * Fungsi ini akan menerima tanggal dalam berbagai format dan mengembalikan hasil penanganannya
 */
export function handleDateTest(req: Request, res: Response) {
  try {
    const { date, type } = req.body;
    
    if (!date) {
      return res.status(400).json({ error: "Missing date parameter" });
    }
    
    console.log(`Received date test request with type=${type}, date=${date}`);
    
    // Mencatat tipe data input
    const inputType = typeof date;
    console.log(`Input date type: ${inputType}`);
    
    // Variabel untuk berbagai format date
    let dateObject: Date;
    let isoString: string;
    let formattedDate: string;
    let utcDate: string;
    
    // Penanganan berdasarkan tipe input
    if (inputType === 'string') {
      if (date.includes('T')) {
        // ISO string
        console.log("Handling as ISO string");
        
        // Parse dengan metode standar lama
        const oldParsed = new Date(date);
        console.log(`Old parsing result: ${oldParsed.toISOString()}`);
        
        // Parse dengan metode baru
        const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
          const [_, year, month, day] = dateMatch.map(Number);
          
          // UTC date tanpa timezone offset
          const utcDateObj = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
          console.log(`UTC date from parts: ${utcDateObj.toISOString()}`);
          
          // Local date
          const localDateObj = new Date(year, month - 1, day, 0, 0, 0, 0);
          console.log(`Local date from parts: ${localDateObj.toISOString()}`);
          
          // Final date dengan timezone reset
          dateObject = new Date(utcDateObj.getUTCFullYear(), utcDateObj.getUTCMonth(), utcDateObj.getUTCDate());
        } else {
          dateObject = oldParsed;
        }
      } else {
        // Assuming yyyy-MM-dd format
        console.log("Handling as yyyy-MM-dd format");
        const parts = date.split('-');
        if (parts.length === 3) {
          const [year, month, day] = parts.map(Number);
          dateObject = new Date(year, month - 1, day, 0, 0, 0, 0);
        } else {
          throw new Error(`Invalid date format: ${date}`);
        }
      }
    } else {
      // Handle as direct Date object (even though it's probably stringified already)
      console.log("Handling as date object (though it's likely a string after transmission)");
      dateObject = new Date(date);
    }
    
    // Format untuk respons
    isoString = dateObject.toISOString();
    
    // Format untuk yyyy-MM-dd
    const year = dateObject.getFullYear();
    const month = String(dateObject.getMonth() + 1).padStart(2, '0');
    const day = String(dateObject.getDate()).padStart(2, '0');
    formattedDate = `${year}-${month}-${day}`;
    
    // Format UTC/GMT
    utcDate = dateObject.toUTCString();
    
    // Prepare an informative response
    const response = {
      success: true,
      input: {
        value: date,
        type: inputType,
        testType: type
      },
      parsed: {
        original: dateObject.toString(),
        iso: isoString,
        formatted: formattedDate,
        utc: utcDate,
        timestamp: dateObject.getTime(),
      },
      timezoneInfo: {
        utcOffset: dateObject.getTimezoneOffset(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }
    };
    
    console.log("Date test response:", response);
    return res.status(200).json(response);
  } catch (error) {
    console.error("Error in date test handler:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}