/**
 * Authentication and token management services
 */

import { AccountInfo, IPublicClientApplication } from "@azure/msal-browser";
import { dataverseConfig } from "../../config/authConfig";
import { createFetchHeaders } from "./common";

/**
 * Get access token for Dataverse
 */
export async function getAccessToken(
    instance: IPublicClientApplication,
    account: AccountInfo
): Promise<string> {
    const response = await instance.acquireTokenSilent({
        scopes: dataverseConfig.scopes,
        account: account,
    });
    return response.accessToken;
}

/**
 * Fetch Employee ID from systemusers table using Azure AD Object ID
 */
export async function fetchEmployeeIdFromSystemUser(
    accessToken: string,
    azureAdObjectId: string
): Promise<string | null> {
    const filter = `azureactivedirectoryobjectid eq ${azureAdObjectId}`;
    const url = `${dataverseConfig.baseUrl}/systemusers?$filter=${encodeURIComponent(filter)}&$select=systemuserid,fullname,_crdfd_employee2_value`;

    try {
        const response = await fetch(url, {
            headers: createFetchHeaders(accessToken),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Error fetching systemuser:", response.status, errorText);
            return null;
        }

        const data = await response.json();

        if (data.value && data.value.length > 0) {
            const employeeId = data.value[0]._crdfd_employee2_value;
            if (employeeId) {
                return employeeId;
            }
        }
        return null;
    } catch (e) {
        console.error("Error fetching employee ID from systemuser:", e);
        return null;
    }
}

/**
 * Fetch Employee Code using Employee ID
 */
export async function fetchEmployeeCode(
    accessToken: string,
    employeeId: string
): Promise<string | null> {
    const filter = `crdfd_employeeid eq ${employeeId} and statecode eq 0`;
    const select = "crdfd_manhanvien";
    const url = `${dataverseConfig.baseUrl}/crdfd_employees?$filter=${encodeURIComponent(filter)}&$select=${select}`;

    try {
        const response = await fetch(url, {
            headers: createFetchHeaders(accessToken),
        });

        if (response.ok) {
            const data = await response.json();
            if (data.value && data.value.length > 0) {
                return data.value[0].crdfd_manhanvien;
            }
            return null;
        }
        console.error("Error fetching employee code:", await response.text());
        return null;
    } catch (e) {
        console.error("Exception fetching employee code:", e);
        return null;
    }
}

/**
 * Fetch Subject ID (Tong Hop Doi Tuong) using Employee Code
 */
export async function fetchSubjectId(
    accessToken: string,
    employeeCode: string
): Promise<string | null> {
    const filter = `cr44a_maoituong eq '${employeeCode}' and statecode eq 0`;
    const select = "crdfd_tnghpitngid";
    const url = `${dataverseConfig.baseUrl}/crdfd_tnghpitngs?$filter=${encodeURIComponent(filter)}&$select=${select}`;

    try {
        const response = await fetch(url, {
            headers: createFetchHeaders(accessToken),
        });

        if (response.ok) {
            const data = await response.json();
            if (data.value && data.value.length > 0) {
                return data.value[0].crdfd_tnghpitngid;
            }
        }
        console.error("Error fetching subject ID or not found:", await response.text());
        return null;
    } catch (e) {
        console.error("Exception fetching subject ID:", e);
        return null;
    }
}

