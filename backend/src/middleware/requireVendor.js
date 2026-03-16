import { supabase } from '../config/supabase.js';

export async function requireVendor(request, reply) {
  const userId = request.user.sub;

  const { data: vendor } = await supabase
    .from('vendor_profiles')
    .select('id, status')
    .eq('user_id', userId)
    .single();

  if (!vendor) {
    return reply.status(403).send({
      success: false,
      error: 'Vendor profile required. Register as a vendor first.',
    });
  }

  if (vendor.status === 'pending') {
    return reply.status(403).send({ success: false, error: 'Vendor application pending approval.' });
  }

  if (vendor.status === 'suspended') {
    return reply.status(403).send({ success: false, error: 'Vendor account suspended.' });
  }

  // Attach to request so services can use it without another DB call
  request.vendor = vendor;
}
