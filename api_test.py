import base64
import requests

# 1) FILL THESE IN FROM YOUR SPOTIFY DEV DASHBOARD
CLIENT_ID = "ee1e8f44848e4212a986bc4b29f0f87e"
CLIENT_SECRET = "ae1ccda290244f5980da5e9c5bd0b3b2"

# 2) Track you want to test
TRACK_ID = "6fR6ZOVc1K6yQWNUlKjAIR"  # one of your playlist tracks is fine

def get_access_token(client_id: str, client_secret: str) -> str:
    auth_str = f"{client_id}:{client_secret}"
    b64_auth = base64.b64encode(auth_str.encode()).decode()

    token_url = "https://accounts.spotify.com/api/token"
    headers = {"Authorization": f"Basic {b64_auth}"}
    data = {"grant_type": "client_credentials"}

    resp = requests.post(token_url, headers=headers, data=data)
    print("Token status:", resp.status_code)
    if resp.status_code != 200:
        print("Token error body:", resp.text)
        resp.raise_for_status()

    return resp.json()["access_token"]

def get_audio_features(track_id: str, access_token: str):
    url = f"https://api.spotify.com/v1/audio-features/{track_id}"
    headers = {"Authorization": f"Bearer {access_token}"}

    resp = requests.get(url, headers=headers)
    print("Audio features status:", resp.status_code)
    print("Body:", resp.text)
    resp.raise_for_status()

    return resp.json()

if __name__ == "__main__":
    token = get_access_token(CLIENT_ID, CLIENT_SECRET)
    data = get_audio_features(TRACK_ID, token)

    print("\nParsed values:")
    print("Tempo (BPM):", data["tempo"])
    print("Key (0-11):", data["key"])
    print("Mode (1=major,0=minor):", data["mode"])
