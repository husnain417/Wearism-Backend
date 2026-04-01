// src/services/notifications.js
import { getMessaging } from '../config/firebase.js';
import { supabase } from '../config/supabase.js';

// ── SAVE TOKEN ────────────────────────────────────────────
export async function saveFcmToken(userId, token) {
  await supabase
    .from('profiles')
    .update({
      fcm_token:            token,
      fcm_token_updated_at: new Date().toISOString(),
    })
    .eq('id', userId);
}


// ── SEND TO ONE USER ──────────────────────────────────────
export async function sendToUser(userId, { title, body, data = {} }) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('fcm_token')
    .eq('id', userId)
    .single();

  if (!profile?.fcm_token) return { sent: false, reason: 'no_token' };

  try {
    const messaging = getMessaging();
    if (!messaging) return { sent: false, reason: 'firebase_not_initialized' };

    await messaging.send({
      token: profile.fcm_token,
      notification: { title, body },
      data: {
        ...Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        ),
      },
      android: { priority: 'high' },
      apns:    { payload: { aps: { sound: 'default' } } },
    });
    return { sent: true };
  } catch (err) {
    // Token expired or invalid — clean it up
    if (err.code === 'messaging/registration-token-not-registered') {
      await supabase.from('profiles')
        .update({ fcm_token: null })
        .eq('id', userId);
    }
    console.error('[FCM] Send failed:', err.message);
    return { sent: false, reason: err.code };
  }
}


// ── SEND TO MULTIPLE USERS ────────────────────────────────
export async function sendToUsers(userIds, notification) {
  // Fire and forget — don't block the caller
  const results = await Promise.allSettled(
    userIds.map(uid => sendToUser(uid, notification))
  );
  const sent   = results.filter(r => r.value?.sent).length;
  const failed = results.length - sent;
  console.log(`[FCM] Sent ${sent}/${results.length} (${failed} failed)`);
}
