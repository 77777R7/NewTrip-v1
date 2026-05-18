using UnityEngine;

namespace NewTrip.Client.Road
{
    [ExecuteAlways]
    [RequireComponent(typeof(MeshFilter), typeof(MeshRenderer))]
    public sealed class RoadShoulderRenderer : MonoBehaviour
    {
        private static readonly int MainTexSt = Shader.PropertyToID("_MainTex_ST");

        public Pseudo3DRoadRenderer roadRenderer;
        public RoadMotionState motionState;

        [Range(8, 96)]
        public int sliceCount = 48;

        [Range(0.02f, 0.45f)]
        public float shoulderWidthMultiplier = 0.22f;

        public float textureRepeat = 5f;
        public float textureMetersPerRepeat = 16f;
        public float scrollMultiplier = 0.85f;
        public bool animateInEditMode;
        public bool useDepthAwareMotion = true;

        [Range(0f, 1f)]
        public float horizonMotionMultiplier = 0.08f;

        [Range(0.25f, 4f)]
        public float motionDepthCurve = 1.25f;

        public bool useHorizonFade = true;

        [Range(0f, 1f)]
        public float horizonFadeStartDepth = 0.64f;

        [Range(0f, 1f)]
        public float horizonAlpha = 0.18f;

        public Color nearTint = new Color(0.43f, 0.3f, 0.2f, 1f);
        public Color farTint = new Color(0.48f, 0.35f, 0.25f, 1f);

        private MeshFilter meshFilter;
        private MeshRenderer meshRenderer;
        private Mesh shoulderMesh;
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
            Vector3[] vertices = new Vector3[vertexRows * 4];
            meshUvs = new Vector2[vertices.Length];
            Color[] colors = new Color[vertices.Length];
            int[] triangles = new int[sliceCount * 12];

            for (int i = 0; i < vertexRows; i++)
            {
                float depth = i / (float)sliceCount;
                RoadProjectionSample sample = roadRenderer.Sample(depth);
                int index = i * 4;
                float outerMultiplier = 1f + shoulderWidthMultiplier;
                Color vertexColor = Color.Lerp(nearTint, farTint, Mathf.Clamp01(depth));

                if (useHorizonFade)
                {
                    float fadeT = Mathf.InverseLerp(horizonFadeStartDepth, 1f, depth);
                    vertexColor.a *= Mathf.Lerp(1f, horizonAlpha, Mathf.Clamp01(fadeT));
                }

                vertices[index] = sample.PointAt(-outerMultiplier, 0.01f);
                vertices[index + 1] = sample.PointAt(-1f, 0.01f);
                vertices[index + 2] = sample.PointAt(1f, 0.01f);
                vertices[index + 3] = sample.PointAt(outerMultiplier, 0.01f);

                float v = GetV(depth, CurrentMotionOffset());
                meshUvs[index] = new Vector2(0f, v);
                meshUvs[index + 1] = new Vector2(1f, v);
                meshUvs[index + 2] = new Vector2(0f, v);
                meshUvs[index + 3] = new Vector2(1f, v);

                colors[index] = vertexColor;
                colors[index + 1] = vertexColor;
                colors[index + 2] = vertexColor;
                colors[index + 3] = vertexColor;
            }

            for (int i = 0; i < sliceCount; i++)
            {
                int tri = i * 12;
                int row = i * 4;
                int next = row + 4;

                triangles[tri] = row;
                triangles[tri + 1] = next;
                triangles[tri + 2] = row + 1;
                triangles[tri + 3] = row + 1;
                triangles[tri + 4] = next;
                triangles[tri + 5] = next + 1;

                triangles[tri + 6] = row + 2;
                triangles[tri + 7] = next + 2;
                triangles[tri + 8] = row + 3;
                triangles[tri + 9] = row + 3;
                triangles[tri + 10] = next + 2;
                triangles[tri + 11] = next + 3;
            }

            if (shoulderMesh == null)
            {
                shoulderMesh = new Mesh
                {
                    name = "RoadShoulderMesh"
                };
            }
            else
            {
                shoulderMesh.Clear();
            }

            shoulderMesh.vertices = vertices;
            shoulderMesh.uv = meshUvs;
            shoulderMesh.colors = colors;
            shoulderMesh.triangles = triangles;
            shoulderMesh.RecalculateBounds();
            shoulderMesh.RecalculateNormals();

            meshFilter.sharedMesh = shoulderMesh;
            ApplyTextureMotion();
        }

        private void UpdateMeshUvs(float motionOffset)
        {
            if (shoulderMesh == null || meshUvs == null || meshUvs.Length != (sliceCount + 1) * 4)
            {
                return;
            }

            for (int i = 0; i <= sliceCount; i++)
            {
                float depth = i / (float)sliceCount;
                float v = GetV(depth, motionOffset);
                int index = i * 4;
                meshUvs[index] = new Vector2(0f, v);
                meshUvs[index + 1] = new Vector2(1f, v);
                meshUvs[index + 2] = new Vector2(0f, v);
                meshUvs[index + 3] = new Vector2(1f, v);
            }

            shoulderMesh.uv = meshUvs;
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
            return depth * textureRepeat - motionOffset * depthMultiplier;
        }

        private float DepthMotionMultiplier(float depth)
        {
            float nearFactor = Mathf.Pow(1f - Mathf.Clamp01(depth), motionDepthCurve);
            return Mathf.Lerp(horizonMotionMultiplier, 1f, nearFactor);
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
                meshRenderer.sortingOrder = 8;
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
