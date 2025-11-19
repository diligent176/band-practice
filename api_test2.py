import base64
import time
import requests

# CLIENT_ID = "ee1e8f44848e4212a986bc4b29f0f87e"
# CLIENT_SECRET = "ae1ccda290244f5980da5e9c5bd0b3b2"
CLIENT_ID = "9dcdc500adbd4425b3c37fdcc0945bd8"
CLIENT_SECRET = "72837fc0548f481da7fa51d319e64cde"
TRACK_ID = "6fR6ZOVc1K6yQWNUlKjAIR"

def get_access_token(client_id: str, client_secret: str) -> str:
    auth_str = f"{client_id}:{client_secret}"
    b64_auth = base64.b64encode(auth_str.encode()).decode()

    token_url = "https://accounts.spotify.com/api/token"
    headers = {"Authorization": f"Basic {b64_auth}"}
    data = {"grant_type": "client_credentials"}

    for attempt in range(3):
        resp = requests.post(token_url, headers=headers, data=data)
        print(f"Token status (attempt {attempt+1}):", resp.status_code)
        print("Token body:", resp.text)

        if resp.status_code == 200:
            return resp.json()["access_token"]

        # 5xx = server/proxy problem, try again
        if 500 <= resp.status_code < 600:
            time.sleep(2)  # short pause then retry
            continue

        # Anything else (400/401/403) – no point retrying
        raise RuntimeError(f"Token request failed: {resp.text}")

    raise RuntimeError("Token request kept failing with 5xx errors")

def get_audio_features(track_id: str, access_token: str):
    url = f"https://api.spotify.com/v1/audio-features/{track_id}"
    headers = {"Authorization": f"Bearer {access_token}"}
    resp = requests.get(url, headers=headers)
    print("Audio features status:", resp.status_code)
    print("Audio features body:", resp.text)
    resp.raise_for_status()
    return resp.json()

if __name__ == "__main__":
    token = get_access_token(CLIENT_ID, CLIENT_SECRET)
    features = get_audio_features(TRACK_ID, token)
    print("\nParsed values:")
    print("Tempo:", features["tempo"])
    print("Key:", features["key"])
    print("Mode:", features["mode"])
