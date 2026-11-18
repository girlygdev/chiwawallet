// "Open email app" on Check your email. There is no web link that opens
// "whatever inbox app you use", so we link to the big webmail inboxes by
// email domain and hide the button for anything else.
const INBOXES: Record<string, string> = {
  "gmail.com": "https://mail.google.com/mail/u/0/#inbox",
  "googlemail.com": "https://mail.google.com/mail/u/0/#inbox",
  "yahoo.com": "https://mail.yahoo.com",
  "ymail.com": "https://mail.yahoo.com",
  "outlook.com": "https://outlook.live.com/mail/",
  "hotmail.com": "https://outlook.live.com/mail/",
  "live.com": "https://outlook.live.com/mail/",
  "icloud.com": "https://www.icloud.com/mail",
  "me.com": "https://www.icloud.com/mail",
};

export function inboxUrlFor(email: string): string | null {
  const domain = email.split("@")[1]?.toLowerCase();
  return (domain && INBOXES[domain]) || null;
}
