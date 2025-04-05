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
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "include",
  });

  // Clone response sebelum memeriksanya
  const clonedRes = res.clone();
  await throwIfResNotOk(clonedRes);
  
  try {
    // Gunakan response asli untuk parse JSON
    return await res.json() as T;
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
    console.log(`Fetching data with getQueryFn: ${url}`);
    
    const res = await fetch(url, {
      credentials: "include",
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
      return data;
    } catch (error) {
      console.warn(`Failed to parse query response from ${url} as JSON:`, error);
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
