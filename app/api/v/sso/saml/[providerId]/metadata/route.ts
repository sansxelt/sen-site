// GET /api/v/sso/saml/[providerId]/metadata — SP metadata XML for an org SAML provider. This is
// PUBLIC service-provider info (entityID + ACS URL) an admin gives their IdP. SAML assertion
// consumption is a SCAFFOLD in v1 (see the ACS route) — this endpoint just describes our SP.
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_req: Request, context: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await context.params;
  if (!/^[0-9a-f-]{10,40}$/i.test(providerId)) return NextResponse.json({ error: "invalid_provider" }, { status: 400 });
  const entityId = `https://vraelis.com/sso/saml/${providerId}`;
  const acs = `https://vraelis.com/api/v/sso/saml/${providerId}/acs`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acs}" index="0" isDefault="true"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
  return new NextResponse(xml, { status: 200, headers: { "content-type": "application/samlmetadata+xml" } });
}
