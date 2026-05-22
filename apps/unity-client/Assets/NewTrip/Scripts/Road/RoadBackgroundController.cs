using UnityEngine;

namespace NewTrip.Client.Road
{
    public enum RoadVisualSegmentKey
    {
        CoastalCliffsSunset,
        BridgeCoastNight,
        BoardwalkApproachMorning
    }

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
        public RoadVisualSegmentKey activeSegment = RoadVisualSegmentKey.CoastalCliffsSunset;
        public bool enforceDrivingLayerPolicy = true;
        public bool showFarBackground = true;
        public bool showMidgroundLandmark;

        [Range(0.1f, 0.6f)]
        public float farBandHeightViewport = 0.32f;

        [Range(0.1f, 0.55f)]
        public float midgroundBandHeightViewport = 0.28f;

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
            float width = roadRenderer != null ? roadRenderer.renderWidth : RoadViewportContract.WorldWidth;
            float height = roadRenderer != null ? roadRenderer.renderHeight : RoadViewportContract.WorldHeight;
            bool midgroundAllowed = showMidgroundLandmark;

            if (enforceDrivingLayerPolicy && activeSegment == RoadVisualSegmentKey.CoastalCliffsSunset)
            {
                midgroundAllowed = false;
            }

            FitSprite(skyLayer, width, height, new Vector2(0.5f, 0.5f), 1.4f, skyTint, -30, SpriteFitMode.Cover);
            SetRendererVisible(farBackgroundLayer, showFarBackground);
            SetRendererVisible(midgroundLandmarkLayer, midgroundAllowed);

            if (showFarBackground)
            {
                FitSprite(farBackgroundLayer, width * 1.08f, height * farBandHeightViewport, new Vector2(0.5f, 0.44f), 1.1f, farTint, -20, SpriteFitMode.Contain);
            }

            if (midgroundAllowed)
            {
                FitSprite(midgroundLandmarkLayer, width * 1.08f, height * midgroundBandHeightViewport, new Vector2(0.5f, 0.43f), 0.8f, midgroundTint, -10, SpriteFitMode.Contain);
            }
        }

        private static void SetRendererVisible(SpriteRenderer renderer, bool visible)
        {
            if (renderer != null)
            {
                renderer.enabled = visible && renderer.sprite != null;
            }
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

            float renderWidth = roadRenderer != null ? roadRenderer.renderWidth : RoadViewportContract.WorldWidth;
            float renderHeight = roadRenderer != null ? roadRenderer.renderHeight : RoadViewportContract.WorldHeight;
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
