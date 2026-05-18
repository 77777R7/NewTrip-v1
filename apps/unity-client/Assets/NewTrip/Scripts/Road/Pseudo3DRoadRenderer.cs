using UnityEngine;

namespace NewTrip.Client.Road
{
    [ExecuteAlways]
    [RequireComponent(typeof(MeshFilter), typeof(MeshRenderer))]
    public sealed class Pseudo3DRoadRenderer : MonoBehaviour
    {
        private static readonly int MainTexSt = Shader.PropertyToID("_MainTex_ST");

        public RoadMotionState motionState;
        public RoadProjectionSettings projection = new RoadProjectionSettings();
        public RoadProjectionPreset projectionPreset = RoadProjectionPreset.BigSurPrototype;
        public bool applyProjectionPresetOnRebuild = true;

        [Range(8, 96)]
        public int sliceCount = 48;

        public float renderWidth = 5.625f;
        public float renderHeight = 10f;
        public float textureRepeat = 7f;
        public float textureOffset;
        public float textureMetersPerRepeat = 18f;

        [Header("Source texture window")]
        [Range(0f, 1f)]
        public float textureUMin;

        [Range(0f, 1f)]
        public float textureUMax = 1f;

        public bool useWidthBasedTextureU = true;

        [Min(0.05f)]
        public float asphaltTileWorldWidth = 0.75f;

        public float visualSpeed = 1f;
        public bool animateInEditMode;
        public bool useDepthAwareMotion = true;

        [Range(0f, 1f)]
        public float horizonMotionMultiplier = 0.06f;

        [Range(0.25f, 4f)]
        public float motionDepthCurve = 1.35f;

        public bool useHorizonFade = true;

        [Range(0f, 1f)]
        public float horizonFadeStartDepth = 0.68f;

        [Range(0f, 1f)]
        public float horizonAlpha = 0.12f;

        public Color nearTint = new Color(0.27f, 0.26f, 0.27f, 1f);
        public Color farTint = new Color(0.34f, 0.27f, 0.28f, 1f);

        private MeshFilter meshFilter;
        private MeshRenderer meshRenderer;
        private Mesh roadMesh;
        private MaterialPropertyBlock propertyBlock;
        private float uvScroll;
        private Vector2[] meshUvs;

        public float VisualSpeed => motionState != null ? motionState.VisualSpeedNorm : visualSpeed;

        public float VisualDistanceMeters => motionState != null ? motionState.VisualDistanceMeters : uvScroll * Mathf.Max(0.01f, textureMetersPerRepeat);

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
            renderWidth = Mathf.Max(1f, renderWidth);
            renderHeight = Mathf.Max(1f, renderHeight);
            EnsureComponents();
            RebuildMesh();
        }

        private void Update()
        {
            if (!Application.isPlaying && !animateInEditMode)
            {
                return;
            }

            if (motionState == null)
            {
                uvScroll = Mathf.Repeat(uvScroll + visualSpeed * Time.deltaTime, 1f);
            }

            ApplyTextureMotion();
        }

        public void SetServerSpeed(float serverSpeedKmph)
        {
            visualSpeed = Mathf.Clamp(serverSpeedKmph / 72f, 0f, 1.35f);

            if (motionState != null)
            {
                motionState.SetServerSpeedKmph(serverSpeedKmph);
            }
        }

        public void RefreshMotionForReview()
        {
            ApplyTextureMotion();
        }

        public void ApplyProjectionPreset()
        {
            projection.ApplyPreset(projectionPreset);
            RebuildMesh();
        }

        public RoadProjectionSample Sample(float depth01)
        {
            return projection.Sample(depth01, renderWidth, renderHeight);
        }

        public Vector3 Project(float depth01, float lateralRoadOffset, float z = 0f)
        {
            return Sample(depth01).PointAt(lateralRoadOffset, z);
        }

        public float WidthAtDepth(float depth01)
        {
            return Sample(depth01).HalfWidth * 2f;
        }

        public float HalfWidthAtDepth(float depth01)
        {
            return Sample(depth01).HalfWidth;
        }

        public float YAtDepth(float depth01)
        {
            return Sample(depth01).Y;
        }

        public Vector3 ViewportToLocal(Vector2 viewport, float z = 0f)
        {
            float x = projection.ViewportXToLocal(viewport.x, renderWidth);
            float y = projection.ViewportYToLocal(viewport.y, renderHeight);
            return new Vector3(x, y, z);
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

            if (applyProjectionPresetOnRebuild)
            {
                projection.ApplyPreset(projectionPreset);
            }

            int vertexRows = sliceCount + 1;
            Vector3[] vertices = new Vector3[vertexRows * 2];
            meshUvs = new Vector2[vertices.Length];
            Color[] colors = new Color[vertices.Length];
            int[] triangles = new int[sliceCount * 6];

            for (int i = 0; i < vertexRows; i++)
            {
                float depth = i / (float)sliceCount;
                RoadProjectionSample sample = Sample(depth);
                int leftIndex = i * 2;
                int rightIndex = leftIndex + 1;
                Color vertexColor = Color.Lerp(nearTint, farTint, Mathf.Clamp01(depth));

                if (useHorizonFade)
                {
                    float fadeT = Mathf.InverseLerp(horizonFadeStartDepth, 1f, depth);
                    vertexColor.a *= Mathf.Lerp(1f, horizonAlpha, Mathf.Clamp01(fadeT));
                }

                vertices[leftIndex] = sample.PointAt(-1f);
                vertices[rightIndex] = sample.PointAt(1f);

                float v = GetV(depth, CurrentMotionOffset());
                meshUvs[leftIndex] = new Vector2(TextureU(sample, right: false), v);
                meshUvs[rightIndex] = new Vector2(TextureU(sample, right: true), v);
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

            if (roadMesh == null)
            {
                roadMesh = new Mesh
                {
                    name = "Pseudo3DRoadMesh"
                };
            }
            else
            {
                roadMesh.Clear();
            }

            roadMesh.vertices = vertices;
            roadMesh.uv = meshUvs;
            roadMesh.colors = colors;
            roadMesh.triangles = triangles;
            roadMesh.RecalculateBounds();
            roadMesh.RecalculateNormals();

            meshFilter.sharedMesh = roadMesh;
            ApplyTextureMotion();
        }

        private void UpdateMeshUvs(float motionOffset)
        {
            if (roadMesh == null || meshUvs == null || meshUvs.Length != (sliceCount + 1) * 2)
            {
                return;
            }

            for (int i = 0; i <= sliceCount; i++)
            {
                float depth = i / (float)sliceCount;
                RoadProjectionSample sample = Sample(depth);
                float v = GetV(depth, motionOffset);
                int leftIndex = i * 2;
                meshUvs[leftIndex] = new Vector2(TextureU(sample, right: false), v);
                meshUvs[leftIndex + 1] = new Vector2(TextureU(sample, right: true), v);
            }

            roadMesh.uv = meshUvs;
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

        private float TextureU(RoadProjectionSample sample, bool right)
        {
            float sourceLeft = TextureULeft();
            float sourceRight = TextureURight();

            if (!useWidthBasedTextureU)
            {
                return right ? sourceRight : sourceLeft;
            }

            float sourceCenter = (sourceLeft + sourceRight) * 0.5f;
            float sourceWidth = Mathf.Max(0.0001f, Mathf.Abs(sourceRight - sourceLeft));
            float roadWidthWorld = Mathf.Max(0.001f, sample.HalfWidth * 2f);
            float uScale = roadWidthWorld / Mathf.Max(0.05f, asphaltTileWorldWidth) * sourceWidth;
            return sourceCenter + (right ? uScale * 0.5f : -uScale * 0.5f);
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
                meshRenderer.sortingOrder = 10;
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
