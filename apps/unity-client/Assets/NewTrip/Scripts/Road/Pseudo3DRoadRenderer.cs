using UnityEngine;

namespace NewTrip.Client.Road
{
    [ExecuteAlways]
    [RequireComponent(typeof(MeshFilter), typeof(MeshRenderer))]
    public sealed class Pseudo3DRoadRenderer : MonoBehaviour
    {
        private static readonly int MainTexSt = Shader.PropertyToID("_MainTex_ST");

        public RoadProjectionSettings projection = new RoadProjectionSettings();

        [Range(8, 96)]
        public int sliceCount = 48;

        public float renderWidth = 5.625f;
        public float renderHeight = 10f;
        public float textureRepeat = 7f;
        public float visualSpeed = 1f;
        public bool animateInEditMode;

        private MeshFilter meshFilter;
        private MeshRenderer meshRenderer;
        private Mesh roadMesh;
        private MaterialPropertyBlock propertyBlock;
        private float uvScroll;

        public float VisualSpeed => visualSpeed;

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

            uvScroll = Mathf.Repeat(uvScroll + visualSpeed * Time.deltaTime, 1f);
            ApplyTextureScroll();
        }

        public void SetServerSpeed(float serverSpeedKmph)
        {
            visualSpeed = Mathf.Clamp(serverSpeedKmph / 72f, 0f, 1.35f);
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
            ApplyTextureScroll();
        }

        public void RebuildMesh()
        {
            EnsureComponents();

            int vertexRows = sliceCount + 1;
            Vector3[] vertices = new Vector3[vertexRows * 2];
            Vector2[] uvs = new Vector2[vertices.Length];
            int[] triangles = new int[sliceCount * 12];

            for (int i = 0; i < vertexRows; i++)
            {
                float depth = i / (float)sliceCount;
                RoadProjectionSample sample = Sample(depth);
                int leftIndex = i * 2;
                int rightIndex = leftIndex + 1;

                vertices[leftIndex] = sample.PointAt(-1f);
                vertices[rightIndex] = sample.PointAt(1f);

                float v = depth * textureRepeat;
                uvs[leftIndex] = new Vector2(0f, v);
                uvs[rightIndex] = new Vector2(1f, v);
            }

            for (int i = 0; i < sliceCount; i++)
            {
                int tri = i * 12;
                int row = i * 2;
                int next = row + 2;

                triangles[tri] = row;
                triangles[tri + 1] = row + 1;
                triangles[tri + 2] = next;
                triangles[tri + 3] = row + 1;
                triangles[tri + 4] = next + 1;
                triangles[tri + 5] = next;
                triangles[tri + 6] = row;
                triangles[tri + 7] = next;
                triangles[tri + 8] = row + 1;
                triangles[tri + 9] = row + 1;
                triangles[tri + 10] = next;
                triangles[tri + 11] = next + 1;
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
            roadMesh.uv = uvs;
            roadMesh.triangles = triangles;
            roadMesh.RecalculateBounds();
            roadMesh.RecalculateNormals();

            meshFilter.sharedMesh = roadMesh;
            ApplyTextureScroll();
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

        private void ApplyTextureScroll()
        {
            EnsureComponents();
            meshRenderer.GetPropertyBlock(propertyBlock);
            propertyBlock.SetVector(MainTexSt, new Vector4(1f, 1f, 0f, -uvScroll));
            meshRenderer.SetPropertyBlock(propertyBlock);
        }
    }
}
