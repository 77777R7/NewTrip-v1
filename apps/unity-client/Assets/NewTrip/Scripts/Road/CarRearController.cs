using UnityEngine;

namespace NewTrip.Client.Road
{
    [RequireComponent(typeof(SpriteRenderer))]
    public sealed class CarRearController : MonoBehaviour
    {
        public Pseudo3DRoadRenderer roadRenderer;
        public Vector2 anchorViewport = new Vector2(0.5f, 0.13f);
        public float baseScale = 1.15f;
        public float bobAmplitude = 0.035f;
        public float bobFrequency = 5.2f;
        public float swayAmplitude = 0.018f;
        public float swayFrequency = 1.7f;
        public SpriteRenderer boostGlowRenderer;

        private SpriteRenderer spriteRenderer;
        private float localTime;
        private bool boosting;

        private void Awake()
        {
            spriteRenderer = GetComponent<SpriteRenderer>();
            spriteRenderer.sortingOrder = 100;
            ApplyBaseTransform();
        }

        private void Update()
        {
            localTime += Time.deltaTime;
            ApplyBaseTransform();
        }

        public void SetBoosting(bool isBoosting)
        {
            boosting = isBoosting;

            if (boostGlowRenderer != null)
            {
                boostGlowRenderer.enabled = boosting;
            }
        }

        private void ApplyBaseTransform()
        {
            Vector3 anchor = roadRenderer != null
                ? roadRenderer.ViewportToLocal(anchorViewport, -0.08f)
                : new Vector3(0f, -3.7f, -0.08f);

            float bob = Mathf.Sin(localTime * bobFrequency) * bobAmplitude;
            float sway = Mathf.Sin(localTime * swayFrequency) * swayAmplitude;
            float boostScale = boosting ? 1.04f : 1f;

            transform.localPosition = anchor + new Vector3(sway, bob, 0f);
            transform.localScale = Vector3.one * baseScale * boostScale;
        }
    }
}
