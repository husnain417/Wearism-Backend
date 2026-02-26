import 'dotenv/config'; // Loads .env automatically
import { supabase } from './src/config/supabase.js';

async function testSupabase() {
    console.log('Testing Supabase Connection...');

    // Example 1: Check authentication / project connection by reading time
    // Note: this assumes you have a table or just a general heartbeat. 
    // Let's try to query a table that might or might not exist, or just check the client.

    try {
        // Attempting to select from a non-existent table just to verify the network connection works.
        // If it says "relation does not exist", the connection is successful but the table isn't there!
        // If you actually have a table, replace 'test_users' with your table name.
        const { data, error } = await supabase
            .from('test_users')
            .select('*')
            .limit(1);

        if (error && error.code !== '42P01') { // 42P01 means relation does not exist
            console.error('❌ Connection failed:', error.message);
            return;
        }

        console.log('✅ Connected to Supabase successfully!');


        const { data: insertedData, error: insertError } = await supabase
            .from('test_users')
            .insert([{ name: 'Test User', email: 'test@example.com' }])
            .select();

        if (insertError) {
            console.error('❌ Insert failed:', insertError.message);
        } else {
            console.log('✅ Insert successful:', insertedData);
        }

        console.log('\nTo test inserting data, uncomment the code in this script and replace "your_real_table_name" with an actual table you have created in your Supabase dashboard.');

    } catch (err) {
        console.error('❌ Unexpected error:', err.message);
    }
}

testSupabase();
