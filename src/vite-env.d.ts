/// <reference types="vite/client" />

interface Window {
	__SILORA_CONFIG__?: {
		VITE_SUPABASE_URL?: string;
		VITE_SUPABASE_ANON_KEY?: string;
	};
}
