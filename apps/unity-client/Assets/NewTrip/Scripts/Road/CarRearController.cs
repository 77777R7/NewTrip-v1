using UnityEngine;

namespace NewTrip.Client.Road
{
    [DisallowMultipleComponent]
    public sealed class CarRearController : MonoBehaviour
    {
        [Header("Hierarchy")]
        [SerializeField] private Transform carBody;
        [SerializeField] private Transform contactShadow;
        [SerializeField] private SpriteRenderer[] wheelCueRenderers;

        [Header("Motion Source")]
        [SerializeField] private RoadMotionState roadMotionState;
        [SerializeField] private float debugVisualSpeedNorm;
        [SerializeField] private float speedBlendRate = 0.85f;

        [Header("Perspective Fit")]
        [SerializeField] private Vector2 bodyPerspectiveScale = new Vector2(1f, 0.88f);

        [Header("Engine Bob")]
        [SerializeField] private float idleFrequency = 0.22f;
        [SerializeField] private float driveMetersPerBounce = 22f;
        [SerializeField] private float startupEaseSeconds = 2.8f;
        [SerializeField] private float idleAmplitude = 0.0035f;
        [SerializeField] private float driveAmplitude = 0.017f;

        [Header("Contact Shadow")]
        [SerializeField] private float shadowShrinkFactor = 0.08f;
        [SerializeField] private float shadowAlphaFadeFactor = 0.14f;
        [SerializeField] private float shadowSpeedStretchFactor = 0.10f;
        [SerializeField] private float shadowSpeedAlphaBoost = 0.05f;

        [Header("Wheel Speed Cue")]
        [SerializeField] private float wheelCueMetersPerFrame = 2.25f;
        [SerializeField] private float wheelCueMaxAlpha = 0.30f;

        [Header("Optional Effects")]
        [SerializeField] private SpriteRenderer boostGlowRenderer;

        private SpriteRenderer contactShadowRenderer;
        private Vector3 baseShadowScale = Vector3.one;
        private float baseShadowAlpha = 1f;
        private float localTime;
        private float smoothedVisualSpeedNorm;
        private float startupTimer;
        private bool hasCachedShadowState;

        public Transform CarBody
        {
            get => carBody;
            set => carBody = value;
        }

        public Transform ContactShadow
        {
            get => contactShadow;
            set
            {
                contactShadow = value;
                CacheShadowBaseState(force: true);
            }
        }

        public RoadMotionState RoadMotionState
        {
            get => roadMotionState;
            set => roadMotionState = value;
        }

        public float DebugVisualSpeedNorm
        {
            get => debugVisualSpeedNorm;
            set => debugVisualSpeedNorm = Mathf.Max(0f, value);
        }

        private void Awake()
        {
            ResolveReferences();
            CacheShadowBaseState(force: true);
            ResetChildAnchors();
            EvaluateAtTime(localTime, GetTargetVisualSpeedNorm());
        }

        private void OnEnable()
        {
            ResolveReferences();
            CacheShadowBaseState(force: false);
            ResetChildAnchors();
        }

        private void OnValidate()
        {
            idleFrequency = Mathf.Max(0f, idleFrequency);
            driveMetersPerBounce = Mathf.Max(0.1f, driveMetersPerBounce);
            startupEaseSeconds = Mathf.Max(0.01f, startupEaseSeconds);
            idleAmplitude = Mathf.Max(0f, idleAmplitude);
            driveAmplitude = Mathf.Max(0f, driveAmplitude);
            shadowShrinkFactor = Mathf.Clamp01(shadowShrinkFactor);
            shadowAlphaFadeFactor = Mathf.Clamp01(shadowAlphaFadeFactor);
            shadowSpeedStretchFactor = Mathf.Clamp01(shadowSpeedStretchFactor);
            shadowSpeedAlphaBoost = Mathf.Clamp01(shadowSpeedAlphaBoost);
            wheelCueMetersPerFrame = Mathf.Max(0.1f, wheelCueMetersPerFrame);
            wheelCueMaxAlpha = Mathf.Clamp01(wheelCueMaxAlpha);
            speedBlendRate = Mathf.Max(0.01f, speedBlendRate);
            debugVisualSpeedNorm = Mathf.Max(0f, debugVisualSpeedNorm);
            ResetChildAnchors();
        }

        private void Update()
        {
            ResolveReferences();
            CacheShadowBaseState(force: false);

            localTime += Time.deltaTime;
            startupTimer += Time.deltaTime;

            float targetSpeed = GetTargetVisualSpeedNorm();
            float blendT = 1f - Mathf.Exp(-speedBlendRate * Time.deltaTime);
            smoothedVisualSpeedNorm = Mathf.Lerp(smoothedVisualSpeedNorm, targetSpeed, blendT);

            EvaluateAtTime(localTime, smoothedVisualSpeedNorm);
        }

        public void SetReferences(Transform body, Transform shadow, RoadMotionState motionState = null)
        {
            carBody = body;
            contactShadow = shadow;

            if (motionState != null)
            {
                roadMotionState = motionState;
            }

            CacheShadowBaseState(force: true);
            ResetChildAnchors();
            EvaluateAtTime(localTime, GetTargetVisualSpeedNorm());
        }

        public void SetWheelCues(params SpriteRenderer[] renderers)
        {
            wheelCueRenderers = renderers;
            ResolveReferences();
            EvaluateAtTime(localTime, GetTargetVisualSpeedNorm());
        }

        public void ResetBaseShadowState()
        {
            CacheShadowBaseState(force: true);
        }

        public void EvaluateForReview(float reviewTimeSeconds, float visualSpeedNorm)
        {
            ResolveReferences();
            CacheShadowBaseState(force: false);
            localTime = Mathf.Max(0f, reviewTimeSeconds);
            startupTimer = localTime;
            smoothedVisualSpeedNorm = Mathf.Max(0f, visualSpeedNorm);
            EvaluateAtTime(localTime, smoothedVisualSpeedNorm);
        }

        public void SetBoosting(bool isBoosting)
        {
            if (boostGlowRenderer != null)
            {
                boostGlowRenderer.enabled = isBoosting;
            }
        }

        private float GetTargetVisualSpeedNorm()
        {
            if (roadMotionState != null)
            {
                return Mathf.Max(0f, roadMotionState.VisualSpeedNorm);
            }

            return Mathf.Max(0f, debugVisualSpeedNorm);
        }

        private void EvaluateAtTime(float timeSeconds, float visualSpeedNorm)
        {
            if (carBody == null)
            {
                ApplyContactShadowResponse(0f, Mathf.Max(idleAmplitude, driveAmplitude));
                ApplyWheelCueResponse(0f, 0f);
                return;
            }

            float speedT = Mathf.Clamp01(visualSpeedNorm);
            float startupT = Mathf.Clamp01(startupTimer / Mathf.Max(0.01f, startupEaseSeconds));
            startupT = startupT * startupT * (3f - 2f * startupT);
            float motionT = speedT * startupT;
            float currentAmplitude = Mathf.Lerp(idleAmplitude, driveAmplitude, motionT);

            float visualDistance = GetVisualDistanceForMotion(timeSeconds, visualSpeedNorm);
            float idleWave = Mathf.Abs(Mathf.Sin(2f * Mathf.PI * idleFrequency * timeSeconds));
            float roadWave = Mathf.Abs(Mathf.Sin(2f * Mathf.PI * visualDistance / driveMetersPerBounce));
            float bounceWave = Mathf.Lerp(idleWave, Mathf.Pow(roadWave, 1.35f), motionT);
            float offsetY = bounceWave * currentAmplitude;

            // PlayerCarRoot 的世界/本地坐标不在这里修改；只有 CarBody 的局部 Y 轴参与慢速悬挂起伏。
            carBody.localPosition = new Vector3(0f, offsetY, 0f);
            carBody.localScale = new Vector3(bodyPerspectiveScale.x, bodyPerspectiveScale.y, 1f);

            ApplyContactShadowResponse(offsetY, currentAmplitude, motionT);
            ApplyWheelCueResponse(visualDistance, motionT);
        }

        private float GetVisualDistanceForMotion(float timeSeconds, float visualSpeedNorm)
        {
            if (roadMotionState != null)
            {
                return roadMotionState.VisualDistanceMeters;
            }

            float baselineMetersPerSecond = RoadMotionState.DefaultBaselineSpeedKmph * 1000f / 3600f;
            return Mathf.Max(0f, visualSpeedNorm) * baselineMetersPerSecond * Mathf.Max(0f, timeSeconds);
        }

        private void ApplyContactShadowResponse(float offsetY, float currentAmplitude)
        {
            ApplyContactShadowResponse(offsetY, currentAmplitude, Mathf.Clamp01(smoothedVisualSpeedNorm));
        }

        private void ApplyContactShadowResponse(float offsetY, float currentAmplitude, float speedT)
        {
            if (contactShadow == null)
            {
                return;
            }

            // 接触阴影必须钉在 PlayerCarRoot 的地面接触点上，不能跟随车身上下移动。
            contactShadow.localPosition = new Vector3(0f, 0f, contactShadow.localPosition.z);

            float normalizedOffset = currentAmplitude > 0.0001f
                ? Mathf.Clamp01(offsetY / currentAmplitude)
                : 0f;

            float scaleMultiplier = 1f - normalizedOffset * shadowShrinkFactor;
            float speedStretch = Mathf.Clamp01(speedT) * shadowSpeedStretchFactor;
            contactShadow.localScale = new Vector3(
                baseShadowScale.x * scaleMultiplier * (1f + speedStretch),
                baseShadowScale.y * scaleMultiplier * (1f - speedStretch * 0.35f),
                baseShadowScale.z
            );

            if (contactShadowRenderer == null)
            {
                return;
            }

            // 车身弹起时，阴影轻微缩小并变淡，制造“离地一点点”的接触感。
            Color shadowColor = contactShadowRenderer.color;
            shadowColor.a = baseShadowAlpha * (1f - normalizedOffset * shadowAlphaFadeFactor + Mathf.Clamp01(speedT) * shadowSpeedAlphaBoost);
            contactShadowRenderer.color = shadowColor;
        }

        private void ApplyWheelCueResponse(float visualDistance, float speedT)
        {
            if (wheelCueRenderers == null || wheelCueRenderers.Length == 0)
            {
                return;
            }

            float clampedSpeed = Mathf.Clamp01(speedT);
            float frameT = Mathf.PingPong(visualDistance / wheelCueMetersPerFrame, 1f);
            float pulse = Mathf.Lerp(0.45f, 1f, frameT);
            float alpha = wheelCueMaxAlpha * clampedSpeed * pulse;

            for (int i = 0; i < wheelCueRenderers.Length; i++)
            {
                SpriteRenderer renderer = wheelCueRenderers[i];
                if (renderer == null)
                {
                    continue;
                }

                renderer.enabled = alpha > 0.02f;
                Color color = renderer.color;
                color.a = alpha;
                renderer.color = color;
            }
        }

        private void ResetChildAnchors()
        {
            if (carBody != null)
            {
                carBody.localPosition = new Vector3(0f, Mathf.Max(0f, carBody.localPosition.y), 0f);
                carBody.localScale = new Vector3(bodyPerspectiveScale.x, bodyPerspectiveScale.y, 1f);
            }

            if (contactShadow != null)
            {
                contactShadow.localPosition = new Vector3(0f, 0f, contactShadow.localPosition.z);
            }
        }

        private void ResolveReferences()
        {
            if (carBody == null)
            {
                carBody = transform.Find("CarBody");
            }

            if (contactShadow == null)
            {
                contactShadow = transform.Find("ContactShadow");
            }

            if (roadMotionState == null)
            {
                roadMotionState = Object.FindAnyObjectByType<RoadMotionState>(FindObjectsInactive.Exclude);
            }

            if ((wheelCueRenderers == null || wheelCueRenderers.Length == 0) && carBody != null)
            {
                wheelCueRenderers = carBody.GetComponentsInChildren<SpriteRenderer>(includeInactive: true);
                int count = 0;
                for (int i = 0; i < wheelCueRenderers.Length; i++)
                {
                    if (wheelCueRenderers[i] != null && wheelCueRenderers[i].name.StartsWith("WheelCue"))
                    {
                        wheelCueRenderers[count++] = wheelCueRenderers[i];
                    }
                }

                if (count != wheelCueRenderers.Length)
                {
                    System.Array.Resize(ref wheelCueRenderers, count);
                }
            }
        }

        private void CacheShadowBaseState(bool force)
        {
            if (contactShadow == null || (hasCachedShadowState && !force))
            {
                return;
            }

            contactShadowRenderer = contactShadow.GetComponent<SpriteRenderer>();
            baseShadowScale = contactShadow.localScale;
            baseShadowAlpha = contactShadowRenderer != null ? contactShadowRenderer.color.a : 1f;
            hasCachedShadowState = true;
        }
    }
}
