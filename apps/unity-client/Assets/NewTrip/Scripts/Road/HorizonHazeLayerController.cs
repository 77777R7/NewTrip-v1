using UnityEngine;

namespace NewTrip.Client.Road
{
    [ExecuteAlways]
    [RequireComponent(typeof(SpriteRenderer))]
    public sealed class HorizonHazeLayerController : MonoBehaviour
    {
        [Header("Horizon Haze")]
        [Tooltip("Atmospheric compositing alpha. This should stay subtle; if the haze reads as a fog strip, the value is too high.")]
        [Range(0f, 0.55f)]
        public float hazeAlpha = 0.30f;

        [Tooltip("Warm sunset tint for the transparent haze PNG. Keep this pale and low-saturation.")]
        public Color hazeTintColor = new Color(1f, 0.76f, 0.62f, 1f);

        [Tooltip("Viewport Y for the haze center. It should sit slightly above the road vanishing point.")]
        [Range(0f, 1f)]
        public float hazePositionY = RoadViewportContract.RoadHorizonY + 0.020f;

        [Tooltip("World-space X scale multiplier. Keep the haze wider than the phone frame so side fades extend off screen.")]
        [Range(0.1f, 6f)]
        public float hazeScaleX = 4.0f;

        [Tooltip("World-space Y scale multiplier. Keep this broad enough to read as atmosphere, not a small sprite.")]
        [Range(0.1f, 4f)]
        public float hazeScaleY = 0.50f;

        [Tooltip("Render above the opaque road apex and below future foreground/car/UI objects.")]
        public int hazeSortingOrder = 12;

        private SpriteRenderer spriteRenderer;

        private void Awake()
        {
            Apply();
        }

        private void OnEnable()
        {
            Apply();
        }

        private void OnValidate()
        {
            Apply();
        }

        public void Apply()
        {
            if (spriteRenderer == null)
            {
                spriteRenderer = GetComponent<SpriteRenderer>();
            }

            if (spriteRenderer == null)
            {
                return;
            }

            // HorizonHazeLayer is an atmospheric compositing layer used to soften
            // the road horizon. It is not a normal background object, fog weather,
            // prop, UI, or scenic illustration.
            Color tint = hazeTintColor;
            tint.a = hazeAlpha;
            spriteRenderer.color = tint;
            spriteRenderer.sortingOrder = hazeSortingOrder;
            transform.localScale = new Vector3(hazeScaleX, hazeScaleY, 1f);
            transform.position = new Vector3(0f, ViewportYToWorld(hazePositionY), transform.position.z);
        }

        private static float ViewportYToWorld(float viewportY)
        {
            return (viewportY - 0.5f) * RoadViewportContract.WorldHeight;
        }
    }
}
