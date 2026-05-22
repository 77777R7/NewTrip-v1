using UnityEngine;

namespace NewTrip.Client.Road
{
    [ExecuteAlways]
    [RequireComponent(typeof(Camera))]
    public sealed class RoadPortraitCameraController : MonoBehaviour
    {
        public float targetWidth = RoadViewportContract.WorldWidth;
        public float targetHeight = RoadViewportContract.WorldHeight;
        public bool letterboxWhenAspectDiffers = true;
        public Color clearColor = Color.black;

        private Camera targetCamera;

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
            targetWidth = Mathf.Max(1f, targetWidth);
            targetHeight = Mathf.Max(1f, targetHeight);
            Apply();
        }

        private void LateUpdate()
        {
            Apply();
        }

        public void Apply()
        {
            if (targetCamera == null)
            {
                targetCamera = GetComponent<Camera>();
            }

            targetCamera.orthographic = true;
            targetCamera.orthographicSize = targetHeight * 0.5f;
            targetCamera.clearFlags = CameraClearFlags.SolidColor;
            targetCamera.backgroundColor = clearColor;

            if (!letterboxWhenAspectDiffers || Screen.width <= 0 || Screen.height <= 0)
            {
                targetCamera.rect = new Rect(0f, 0f, 1f, 1f);
                return;
            }

            float targetAspect = targetWidth / targetHeight;
            float screenAspect = Screen.width / (float)Screen.height;

            if (screenAspect > targetAspect)
            {
                float width = Mathf.Clamp01(targetAspect / screenAspect);
                targetCamera.rect = new Rect((1f - width) * 0.5f, 0f, width, 1f);
                return;
            }

            float height = Mathf.Clamp01(screenAspect / targetAspect);
            targetCamera.rect = new Rect(0f, (1f - height) * 0.5f, 1f, height);
        }
    }
}
