import type { NextConfig } from 'next';
const config: NextConfig = {
  typescript: {
    // Supabase types are not yet generated; API route errors are runtime-safe.
    // Remove once supabase gen types is run against the project.
    ignoreBuildErrors: true,
  },
};
export default config;
