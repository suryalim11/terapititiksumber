import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    try {
      // Clone response terlebih dahulu agar tidak mengubah response asli
      const clonedRes = res.clone();
      const errorData = await clonedRes.json();
      console.error("API Error:", errorData);
      throw new Error(errorData.message || `${res.status}: ${res.statusText}`);
    } catch (e) {
      // Jika tidak bisa parse sebagai JSON, gunakan text biasa
      // Clone response lagi untuk mengambil text
      const clonedRes = res.clone();
      const text = await clonedRes.text() || res.statusText;
      console.error("API Error (raw):", text);
      throw new Error(`${res.status}: ${text}`);
    }
  }
}

export async function apiRequest<T = Record<string, unknown>>(
  url: string,
  options?: RequestInit & { data?: any }
): Promise<T> {
  // Filter log untuk mengurangi duplikasi
  if (!url.includes('/api/auth/status')) {
    console.log(`API Request to ${url} with credentials included`);
  }
  
  // Jika ada data dalam options, konversikan ke JSON string dan atur Content-Type
  let finalOptions = { ...options };
  if (options && 'data' in options) {
    console.log(`Sending data to ${url}:`, options.data);
    
    // Hapus data dari options langsung
    const { data, ...restOptions } = options;
    
    // Buat body dari data
    finalOptions = {
      ...restOptions,
      body: JSON.stringify(data),
      headers: {
        ...(restOptions.headers || {}),
        "Content-Type": "application/json",
        "Accept": "application/json"
      }
    };
  }
  
  // Paksakan selalu menggunakan credentials include
  const res = await fetch(url, {
    ...finalOptions,
    credentials: "include",
    headers: {
      ...(finalOptions.headers || {}),
      "Accept": "application/json"
    }
  });

  // Nonaktifkan debug log untuk mengurangi output konsol
  // Kecuali untuk endpoint tertentu yang membutuhkan debugging
  // Menggunakan variabel isDebugMode yang sudah ada di atas
  if (!url.includes('/api/auth/status')) {
    // console.log(`API Response from ${url}: status=${res.status}`);
  }

  // Clone response sebelum memeriksanya
  const clonedRes = res.clone();
  await throwIfResNotOk(clonedRes);
  
  try {
    // Gunakan response asli untuk parse JSON
    const data = await res.json() as T;
    
    // Filter auth status response logs untuk mengurangi spam
    if (!url.includes('/api/auth/status')) {
      console.log(`API data from ${url}:`, 
        Array.isArray(data) ? `Array with ${data.length} items` : 
        (data === null ? 'null' : typeof data));
    }
    
    return data;
  } catch (error) {
    console.warn("Failed to parse response as JSON:", error);
    // Jika tidak bisa di-parse sebagai JSON (misalnya empty body),
    // kembalikan objek kosong
    return {} as unknown as T;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn = <T,>({ on401: unauthorizedBehavior }: {
  on401: UnauthorizedBehavior;
}): QueryFunction<T> => {
  return async ({ queryKey }) => {
    const url = queryKey[0] as string;
    // Hanya log API yang bukan auth status check untuk mengurangi spam log
    if (!url.includes('/api/auth/status')) {
      console.log(`Fetching data with getQueryFn: ${url}`);
    }
    
    const res = await fetch(url, {
      credentials: "include",
      headers: {
        "Accept": "application/json"
      }
    });
    
    console.log(`Response for ${url}: status=${res.status}`);

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      console.log(`401 Unauthorized for ${url}, returning null as configured`);
      return null as unknown as T;
    }

    // Clone response untuk error checking
    const clonedRes = res.clone();
    await throwIfResNotOk(clonedRes);
    
    try {
      // Parse JSON dari response asli
      const data = await res.json() as T;
      console.log(`Successfully parsed data from ${url}:`, 
        Array.isArray(data) ? `Array with ${data.length} items` : 
        (data === null ? 'null' : typeof data));
      
      // Khusus untuk transaksi, tambahan log detail
      if (url === '/api/transactions' && Array.isArray(data)) {
        console.log(`Transactions data: ${data.length} items successfully loaded`);
        if (data.length > 0) {
          console.log(`First transaction ID: ${data[0].transactionId}, createdAt: ${data[0].createdAt}`);
        }
      }
      
      return data;
    } catch (error) {
      console.error(`Failed to parse query response from ${url} as JSON:`, error);
      console.error(`Response status: ${res.status}, statusText: ${res.statusText}`);
      return {} as unknown as T;
    }
  };
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
