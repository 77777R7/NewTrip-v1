using UnityEngine;

namespace NewTrip.Client.Road
{
    [ExecuteAlways]
    [RequireComponent(typeof(MeshFilter), typeof(MeshRenderer))]
    public sealed class LaneMarkingRenderer : MonoBehaviour
    {
        private static readonly int MainTexSt = Shader.PropertyToID("_MainTex_ST");

        public Pseudo3DRoadRenderer roadRenderer;
        public RoadMotionState motionState;

        [Range(8, 96)]
        public int sliceCount = 48;

        public bool useRoadRelativeWidth = true;

        [Range(0.002f, 0.06f)]
        public float laneWidthRoadRatio = 0.052f;

        [Range(0.001f, 0.08f)]
        public float minLaneHalfWidth = 0.026f;

        [Header("Depth viewport width")]
        public bool useDepthViewportWidth;

        [Range(0.0005f, 0.04f)]
        public float nearLaneHalfWidthViewport = 0.01f;

        [Range(0.0005f, 0.02f)]
        public float farLaneHalfWidthViewport = 0.0015f;

        [Range(0.25f, 4f)]
        public float widthDepthCurve = 1f;

        [Header("Projected center offset")]
        public bool useDepthViewportCenterOffset;

        [Range(-0.08f, 0.08f)]
        public float nearCenterOffsetViewport;

        [Range(-0.04f, 0.04f)]
        public float farCenterOffsetViewport;

        [Range(-0.25f, 0.25f)]
        public float centerOffsetRoadRatio;

        [Range(0.25f, 4f)]
        public float centerOffsetDepthCurve = 1f;

        [Header("Source texture window")]
        [Range(0f, 1f)]
        public float textureUMin = 0.34f;

        [Range(0f, 1f)]
        public float textureUMax = 0.66f;

        [Header("Legacy viewport width")]
        [Range(0.002f, 0.08f)]
        public float laneHalfWidthViewport = 0.012f;

        public float textureRepeat = 12f;
        public float textureOffset;
        public float textureMetersPerRepeat = 8f;
        public float scrollMultiplier = 1.6f;
        public bool animateInEditMode;
        public bool useDepthAwareMotion = true;

        [Range(0f, 1f)]
        public float horizonMotionMultiplier = 0.04f;

        [Range(0.25f, 4f)]
        public float motionDepthCurve = 1.2f;

        public bool useHorizonFade = true;

        [Range(0f, 1f)]
        public float horizonFadeStartDepth = 0.68f;

        [Range(0f, 1f)]
        public float horizonAlpha = 0.08f;

        public Color nearTint = Color.white;
        public Color farTint = new Color(1f, 0.86f, 0.64f, 1f);

        private MeshFilter meshFilter;
        private MeshRenderer meshRenderer;
        private Mesh laneMesh;
        private MaterialPropertyBlock propertyBlock;
        private float uvScroll;
        private Vector2[] meshUvs;

        private void Awake()
        {
            EnsureComponents();
            RebuildMesh();
        }

        private void OnEnable()
        {
            EnsureComponents();
            RebuildMesh();
        }

        private void OnValidate()
        {
            sliceCount = Mathf.Max(8, sliceCount);
            EnsureComponents();
            RebuildMesh();
        }

        private void LateUpdate()
        {
            if (roadRenderer == null)
            {
                return;
            }

            if (!Application.isPlaying && !animateInEditMode)
            {
                return;
            }

            if (motionState == null)
            {
                uvScroll = Mathf.Repeat(uvScroll + roadRenderer.VisualSpeed * scrollMultiplier * Time.deltaTime, 1f);
            }

            ApplyTextureMotion();
        }

        public void RefreshMotionForReview()
        {
            ApplyTextureMotion();
        }

        public void SetMaterial(Material material)
        {
            EnsureComponents();
            meshRenderer.sharedMaterial = material;
            ApplyTextureMotion();
        }

        public void RebuildMesh()
        {
            EnsureComponents();

            if (roadRenderer == null)
            {
                return;
            }

            int vertexRows = sliceCount + 1;
            Vector3[] vertices = new Vector3[vertexRows * 2];
            meshUvs = new Vector2[vertices.Length];
            Color[] colors = new Color[vertices.Length];
            int[] triangles = new int[sliceCount * 6];

            for (int i = 0; i < vertexRows; i++)
            {
                float depth = i / (float)sliceCount;
                RoadProjectionSample sample = roadRenderer.Sample(depth);
                float laneHalfWidth = CalculateLaneHalfWidth(depth, sample);
                float laneCenterX = sample.CenterX + CalculateCenterOffset(depth, sample);
                int leftIndex = i * 2;
                int rightIndex = leftIndex + 1;
                Color vertexColor = Color.Lerp(nearTint, farTint, Mathf.Clamp01(depth));

                if (useHorizonFade)
                {
                    float fadeT = Mathf.InverseLerp(horizonFadeStartDepth, 1f, depth);
                    vertexColor.a *= Mathf.Lerp(1f, horizonAlpha, Mathf.Clamp01(fadeT));
                }

                vertices[leftIndex] = new Vector3(laneCenterX - laneHalfWidth, sample.Y, -0.02f);
                vertices[rightIndex] = new Vector3(laneCenterX + laneHalfWidth, sample.Y, -0.02f);

                float v = GetV(depth, CurrentMotionOffset());
                meshUvs[leftIndex] = new Vector2(TextureULeft(), v);
                meshUvs[rightIndex] = new Vector2(TextureURight(), v);
                colors[leftIndex] = vertexColor;
                colors[rightIndex] = vertexColor;
            }

            for (int i = 0; i < sliceCount; i++)
            {
                int tri = i * 6;
                int row = i * 2;
                int next = row + 2;

                triangles[tri] = row;
                triangles[tri + 1] = next;
                triangles[tri + 2] = row + 1;
                triangles[tri + 3] = row + 1;
                triangles[tri + 4] = next;
                triangles[tri + 5] = next + 1;
            }

            if (laneMesh == null)
            {
                laneMesh = new Mesh
                {
                    name = "LaneMarkingMesh"
                };
            }
            else
            {
                laneMesh.Clear();
            }

            laneMesh.vertices = vertices;
            laneMesh.uv = meshUvs;
            laneMesh.colors = colors;
            laneMesh.triangles = triangles;
            laneMesh.RecalculateBounds();
            laneMesh.RecalculateNormals();

            meshFilter.sharedMesh = laneMesh;
            ApplyTextureMotion();
        }

        private void UpdateMeshUvs(float motionOffset)
        {
            if (laneMesh == null || meshUvs == null || meshUvs.Length != (sliceCount + 1) * 2)
            {
                return;
            }

            for (int i = 0; i <= sliceCount; i++)
            {
                float depth = i / (float)sliceCount;
                float v = GetV(depth, motionOffset);
                int leftIndex = i * 2;
                meshUvs[leftIndex] = new Vector2(TextureULeft(), v);
                meshUvs[leftIndex + 1] = new Vector2(TextureURight(), v);
            }

            laneMesh.uv = meshUvs;
        }

        private float CurrentMotionOffset()
        {
            if (motionState != null)
            {
                return motionState.TextureOffset(textureMetersPerRepeat);
            }

            return uvScroll;
        }

        private float GetV(float depth, float motionOffset)
        {
            float depthMultiplier = useDepthAwareMotion ? DepthMotionMultiplier(depth) : 1f;
            return depth * textureRepeat + textureOffset - motionOffset * depthMultiplier;
        }

        private float DepthMotionMultiplier(float depth)
        {
            float nearFactor = Mathf.Pow(1f - Mathf.Clamp01(depth), motionDepthCurve);
            return Mathf.Lerp(horizonMotionMultiplier, 1f, nearFactor);
        }

        private float TextureULeft()
        {
            return Mathf.Min(textureUMin, textureUMax);
        }

        private float TextureURight()
        {
            return Mathf.Max(textureUMin, textureUMax);
        }

        private float CalculateLaneHalfWidth(float depth, RoadProjectionSample sample)
        {
            if (useDepthViewportWidth)
            {
                float t = Mathf.Pow(Mathf.Clamp01(depth), widthDepthCurve);
                float viewportHalfWidth = Mathf.Lerp(nearLaneHalfWidthViewport, farLaneHalfWidthViewport, t);
                return Mathf.Max(minLaneHalfWidth, roadRenderer.renderWidth * viewportHalfWidth);
            }

            if (useRoadRelativeWidth)
            {
                return Mathf.Max(minLaneHalfWidth, sample.HalfWidth * laneWidthRoadRatio);
            }

            return Mathf.Max(minLaneHalfWidth, roadRenderer.renderWidth * laneHalfWidthViewport);
        }

        private float CalculateCenterOffset(float depth, RoadProjectionSample sample)
        {
            if (useDepthViewportCenterOffset)
            {
                float t = Mathf.Pow(Mathf.Clamp01(depth), centerOffsetDepthCurve);
                float viewportOffset = Mathf.Lerp(nearCenterOffsetViewport, farCenterOffsetViewport, t);
                return roadRenderer.renderWidth * viewportOffset;
            }

            return sample.HalfWidth * centerOffsetRoadRatio;
        }

        private void EnsureComponents()
        {
            if (meshFilter == null)
            {
                meshFilter = GetComponent<MeshFilter>();
            }

            if (meshRenderer == null)
            {
                meshRenderer = GetComponent<MeshRenderer>();
                meshRenderer.sortingOrder = 20;
            }

            if (propertyBlock == null)
            {
                propertyBlock = new MaterialPropertyBlock();
            }
        }

        private void ApplyTextureMotion()
        {
            EnsureComponents();
            meshRenderer.GetPropertyBlock(propertyBlock);
            propertyBlock.SetVector(MainTexSt, new Vector4(1f, 1f, 0f, 0f));
            meshRenderer.SetPropertyBlock(propertyBlock);
            UpdateMeshUvs(CurrentMotionOffset());
        }
    }
}
