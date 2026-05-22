Shader "NewTrip/RoadOpaqueVertexColor"
{
    Properties
    {
        _MainTex ("Texture", 2D) = "white" {}
        _Color ("Tint", Color) = (1, 1, 1, 1)
        _WarmBounce ("Warm Bounce", Range(0, 0.5)) = 0.32
        _HorizonWashStrength ("Horizon Wash Strength", Range(0, 1)) = 1
    }
    SubShader
    {
        Tags
        {
            "Queue" = "Transparent"
            "RenderType" = "Opaque"
            "PreviewType" = "Plane"
        }
        LOD 100
        Cull Off
        ZWrite Off
        ZTest Always
        Blend Off

        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "UnityCG.cginc"

            sampler2D _MainTex;
            float4 _MainTex_ST;
            fixed4 _Color;
            fixed _WarmBounce;
            fixed _HorizonWashStrength;

            struct appdata
            {
                float4 vertex : POSITION;
                float2 uv : TEXCOORD0;
                fixed4 color : COLOR;
            };

            struct v2f
            {
                float4 vertex : SV_POSITION;
                float2 uv : TEXCOORD0;
                fixed4 color : COLOR;
            };

            v2f vert(appdata v)
            {
                v2f o;
                o.vertex = UnityObjectToClipPos(v.vertex);
                o.uv = TRANSFORM_TEX(v.uv, _MainTex);
                o.color = v.color * _Color;
                return o;
            }

            fixed4 frag(v2f i) : SV_Target
            {
                fixed4 tex = tex2D(_MainTex, i.uv);
                fixed3 litAsphalt = tex.rgb * i.color.rgb + i.color.rgb * _WarmBounce;
                fixed horizonWash = saturate((1 - i.color.a) * _HorizonWashStrength);
                fixed3 atmosphericRoad = lerp(saturate(litAsphalt), i.color.rgb, horizonWash);
                fixed4 col = fixed4(atmosphericRoad, 1);
                return col;
            }
            ENDCG
        }
    }
}
