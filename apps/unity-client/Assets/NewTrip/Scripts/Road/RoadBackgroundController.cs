using UnityEngine;

namespace NewTrip.Client.Road
{
    public sealed class RoadBackgroundController : MonoBehaviour
    {
        public Pseudo3DRoadRenderer roadRenderer;
        public Camera targetCamera;
        public SpriteRenderer skyLayer;
        public SpriteRenderer farBackgroundLayer;
        public SpriteRenderer midgroundLandmarkLayer;
        public Color skyTint = Color.white;
        public Color farTint = Color.white;
        public Color midgroundTint = Color.white;

        private void Awake()
        {
            ApplyLayout();
        }

        private void OnValidate()
        {
            ApplyLayout();
        }

        public void SetSprites(Sprite sky, Sprite farBackground, Sprite midgroundLandmark)
        {
            if (skyLayer != null)
            {
                skyLayer.sprite = sky;
            }

            if (farBackgroundLayer != null)
            {
                farBackgroundLayer.sprite = farBackground;
            }

            if (midgroundLandmarkLayer != null)
            {
                midgroundLandmarkLayer.sprite = midgroundLandmark;
            }

            ApplyLayout();
        }

        public void ApplyLayout()
        {
            float width = roadRenderer != null ? roadRenderer.renderWidth : 5.625f;
            float height = roadRenderer != null ? roadRenderer.renderHeight : 10f;

            FitSprite(skyLayer, width, height, new Vector2(0.5f, 0.5f), 1.4f, skyTint, 0, SpriteFitMode.Cover);
            FitSprite(farBackgroundLayer, width * 1.04f, height * 0.36f, new Vector2(0.5f, 0.43f), 1.1f, farTint, 5, SpriteFitMode.Cover);
            FitSprite(midgroundLandmarkLayer, width * 1.08f, height * 0.36f, new Vector2(0.5f, 0.42f), 0.8f, midgroundTint, 8, SpriteFitMode.Contain);
        }

        private void FitSprite(
            SpriteRenderer renderer,
            float targetWidth,
            float targetHeight,
            Vector2 anchorViewport,
            float z,
            Color tint,
            int sortingOrder,
            SpriteFitMode fitMode
        )
        {
            if (renderer == null || renderer.sprite == null)
            {
                return;
            }

            float renderWidth = roadRenderer != null ? roadRenderer.renderWidth : 5.625f;
            float renderHeight = roadRenderer != null ? roadRenderer.renderHeight : 10f;
            Vector3 anchor = roadRenderer != null
                ? roadRenderer.ViewportToLocal(anchorViewport, z)
                : new Vector3((anchorViewport.x - 0.5f) * renderWidth, (anchorViewport.y - 0.5f) * renderHeight, z);

            Bounds bounds = renderer.sprite.bounds;
            float scaleX = targetWidth / Mathf.Max(0.001f, bounds.size.x);
            float scaleY = targetHeight / Mathf.Max(0.001f, bounds.size.y);
            float uniformScale = fitMode == SpriteFitMode.Cover
                ? Mathf.Max(scaleX, scaleY)
                : Mathf.Min(scaleX, scaleY);

            renderer.transform.localPosition = anchor;
            renderer.transform.localScale = new Vector3(uniformScale, uniformScale, 1f);
            renderer.color = tint;
            renderer.sortingOrder = sortingOrder;
        }

        private enum SpriteFitMode
        {
            Cover,
            Contain
        }
    }
}
