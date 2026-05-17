using UnityEngine;

namespace NewTrip.Client.Road
{
    public sealed class WeatherOverlayRenderer : MonoBehaviour
    {
        public Pseudo3DRoadRenderer roadRenderer;
        public SpriteRenderer overlayRenderer;
        public Sprite hazeSprite;
        public Sprite rainSprite;
        public Sprite fogSprite;
        public float rainScrollSpeed = 0.55f;

        private string weatherKey = "clear";
        private float scrollTime;

        private void Awake()
        {
            SetWeather("clear");
        }

        private void Update()
        {
            if (overlayRenderer == null || !overlayRenderer.enabled)
            {
                return;
            }

            scrollTime += Time.deltaTime * rainScrollSpeed;

            if (weatherKey == "rain")
            {
                overlayRenderer.transform.localPosition = BasePosition() + new Vector3(Mathf.Repeat(scrollTime, 0.32f), -Mathf.Repeat(scrollTime, 0.48f), -0.12f);
            }
        }

        public void SetWeather(string nextWeatherKey)
        {
            weatherKey = string.IsNullOrEmpty(nextWeatherKey) ? "clear" : nextWeatherKey;

            if (overlayRenderer == null)
            {
                return;
            }

            overlayRenderer.enabled = weatherKey != "clear";
            overlayRenderer.transform.localPosition = BasePosition();
            FitOverlay();

            if (weatherKey == "rain")
            {
                overlayRenderer.sprite = rainSprite;
                overlayRenderer.color = new Color(0.72f, 0.82f, 1f, 0.34f);
            }
            else if (weatherKey == "fog")
            {
                overlayRenderer.sprite = fogSprite;
                overlayRenderer.color = new Color(0.9f, 0.84f, 0.72f, 0.3f);
            }
            else
            {
                overlayRenderer.sprite = hazeSprite;
                overlayRenderer.color = new Color(1f, 0.86f, 0.58f, 0.18f);
            }
        }

        private Vector3 BasePosition()
        {
            return roadRenderer != null ? roadRenderer.ViewportToLocal(new Vector2(0.5f, 0.5f), -0.12f) : new Vector3(0f, 0f, -0.12f);
        }

        private void FitOverlay()
        {
            if (overlayRenderer == null || overlayRenderer.sprite == null)
            {
                return;
            }

            float targetWidth = roadRenderer != null ? roadRenderer.renderWidth : 5.625f;
            float targetHeight = roadRenderer != null ? roadRenderer.renderHeight : 10f;
            Bounds bounds = overlayRenderer.sprite.bounds;
            overlayRenderer.transform.localScale = new Vector3(
                targetWidth / Mathf.Max(0.001f, bounds.size.x),
                targetHeight / Mathf.Max(0.001f, bounds.size.y),
                1f
            );
            overlayRenderer.sortingOrder = 90;
        }
    }
}
