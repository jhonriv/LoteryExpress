export async function apiGet(url) {
  const res = await fetch(url);
  if (!res.ok) {
    const resp = await res.json();
    throw new Error(resp.error);
  }
  return res.json();
}

export async function apiPost(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const resp = await res.json();
    throw new Error(resp.error);
  }
  return res.json();
}

export async function apiPut(url, body) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const resp = await res.json();
    throw new Error(resp.error);
  }
  return res.json();
}
